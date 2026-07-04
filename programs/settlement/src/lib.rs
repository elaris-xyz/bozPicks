use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh");

// ─── Constants ───────────────────────────────────────────────────────────────

const FEE_BPS: u64 = 200;           // 2% protocol fee
const BPS_DENOM: u64 = 10_000;
const MAX_OUTCOME: u8 = 3;          // HOME=0, DRAW=1, AWAY=2

// ─── Program ─────────────────────────────────────────────────────────────────

#[program]
pub mod settlement {
    use super::*;

    /// Create a new parimutuel pool for a match.
    /// Called by the keeper before match starts.
    pub fn create_pool(
        ctx: Context<CreatePool>,
        match_id: String,
        kickoff_ts: i64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.match_id     = match_id;
        pool.authority    = ctx.accounts.authority.key();
        pool.escrow       = ctx.accounts.escrow.key();
        pool.bump         = ctx.bumps.pool;
        pool.escrow_bump  = ctx.bumps.escrow;
        pool.kickoff_ts   = kickoff_ts;
        pool.status       = PoolStatus::Open;
        pool.total_home   = 0;
        pool.total_draw   = 0;
        pool.total_away   = 0;
        pool.total_pool   = 0;
        pool.winning_outcome = None;
        emit!(PoolCreated {
            match_id: pool.match_id.clone(),
            authority: pool.authority,
        });
        Ok(())
    }

    /// Place a prediction — transfers USDC from user to escrow PDA.
    pub fn place_prediction(
        ctx: Context<PlacePrediction>,
        outcome: u8,        // 0=HOME 1=DRAW 2=AWAY
        amount: u64,        // USDC micro-units
    ) -> Result<()> {
        require!(outcome < MAX_OUTCOME, BozError::InvalidOutcome);
        require!(amount >= 1_000_000, BozError::BelowMinimum);   // min 1 USDC

        let pool = &mut ctx.accounts.pool;
        require!(pool.status == PoolStatus::Open, BozError::PoolNotOpen);

        // Transfer USDC user → escrow
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.user_token.to_account_info(),
                    to:        ctx.accounts.escrow.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        // Update pool totals
        match outcome {
            0 => pool.total_home = pool.total_home.checked_add(amount).unwrap(),
            1 => pool.total_draw = pool.total_draw.checked_add(amount).unwrap(),
            _ => pool.total_away = pool.total_away.checked_add(amount).unwrap(),
        }
        pool.total_pool = pool.total_pool.checked_add(amount).unwrap();

        // Write prediction record
        let pred = &mut ctx.accounts.prediction;
        pred.pool       = pool.key();
        pred.user       = ctx.accounts.user.key();
        pred.outcome    = outcome;
        pred.amount     = amount;
        pred.claimed    = false;
        pred.bump       = ctx.bumps.prediction;

        emit!(PredictionPlaced {
            match_id: pool.match_id.clone(),
            user:     pred.user,
            outcome,
            amount,
        });
        Ok(())
    }

    /// Settle pool — called by keeper after TxLINE verify CPI.
    /// winning_outcome: 0=HOME 1=DRAW 2=AWAY
    pub fn settle_pool(
        ctx: Context<SettlePool>,
        winning_outcome: u8,
    ) -> Result<()> {
        require!(winning_outcome < MAX_OUTCOME, BozError::InvalidOutcome);
        let pool = &mut ctx.accounts.pool;
        require!(pool.status == PoolStatus::Open, BozError::PoolNotOpen);
        require!(
            ctx.accounts.authority.key() == pool.authority,
            BozError::Unauthorized
        );

        pool.status          = PoolStatus::Settled;
        pool.winning_outcome = Some(winning_outcome);

        emit!(PoolSettled {
            match_id:        pool.match_id.clone(),
            winning_outcome,
            total_pool:      pool.total_pool,
        });
        Ok(())
    }

    /// Claim payout — winner withdraws proportional share from escrow.
    pub fn claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
        let pool = &ctx.accounts.pool;
        let pred = &mut ctx.accounts.prediction;

        require!(pool.status == PoolStatus::Settled, BozError::NotSettled);
        require!(!pred.claimed, BozError::AlreadyClaimed);
        require!(
            pool.winning_outcome == Some(pred.outcome),
            BozError::DidNotWin
        );

        // Winning side total
        let winning_total = match pred.outcome {
            0 => pool.total_home,
            1 => pool.total_draw,
            _ => pool.total_away,
        };
        require!(winning_total > 0, BozError::InvalidPool);

        // Gross payout = (stake / winning_total) * total_pool
        // Net payout   = gross - 2% fee
        let gross = (pred.amount as u128)
            .checked_mul(pool.total_pool as u128).unwrap()
            .checked_div(winning_total as u128).unwrap() as u64;
        let fee   = gross.checked_mul(FEE_BPS).unwrap()
            .checked_div(BPS_DENOM).unwrap();
        let net   = gross.checked_sub(fee).unwrap();

        // Transfer from escrow PDA → user (PDA signs)
        let match_id_bytes = pool.match_id.as_bytes();
        let seeds = &[
            b"escrow",
            match_id_bytes,
            &[pool.escrow_bump],
        ];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.escrow.to_account_info(),
                    to:        ctx.accounts.user_token.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                signer,
            ),
            net,
        )?;

        pred.claimed = true;

        emit!(PayoutClaimed {
            match_id: pool.match_id.clone(),
            user:     ctx.accounts.user.key(),
            amount:   net,
        });
        Ok(())
    }
}

// ─── Accounts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(match_id: String)]
pub struct CreatePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer  = authority,
        space  = Pool::LEN,
        seeds  = [b"pool", match_id.as_bytes()],
        bump,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        init,
        payer  = authority,
        token::mint      = usdc_mint,
        token::authority = escrow,
        seeds  = [b"escrow", match_id.as_bytes()],
        bump,
    )]
    pub escrow: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, anchor_spl::token::Mint>,

    pub system_program:  Program<'info, System>,
    pub token_program:   Program<'info, Token>,
    pub rent:            Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct PlacePrediction<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool", pool.match_id.as_bytes()],
        bump  = pool.bump,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds  = [b"escrow", pool.match_id.as_bytes()],
        bump   = pool.escrow_bump,
    )]
    pub escrow: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = user,
        space = Prediction::LEN,
        seeds = [b"prediction", pool.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub prediction: Account<'info, Prediction>,

    #[account(mut, constraint = user_token.owner == user.key())]
    pub user_token: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program:  Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SettlePool<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool", pool.match_id.as_bytes()],
        bump  = pool.bump,
    )]
    pub pool: Account<'info, Pool>,
}

#[derive(Accounts)]
pub struct ClaimPayout<'info> {
    pub user: Signer<'info>,

    #[account(
        seeds = [b"pool", pool.match_id.as_bytes()],
        bump  = pool.bump,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [b"prediction", pool.key().as_ref(), user.key().as_ref()],
        bump  = prediction.bump,
        constraint = prediction.user == user.key(),
    )]
    pub prediction: Account<'info, Prediction>,

    #[account(
        mut,
        seeds = [b"escrow", pool.match_id.as_bytes()],
        bump  = pool.escrow_bump,
    )]
    pub escrow: Account<'info, TokenAccount>,

    #[account(mut, constraint = user_token.owner == user.key())]
    pub user_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// ─── State ───────────────────────────────────────────────────────────────────

#[account]
pub struct Pool {
    pub match_id:        String,      // 32 bytes max
    pub authority:       Pubkey,
    pub escrow:          Pubkey,
    pub bump:            u8,
    pub escrow_bump:     u8,
    pub kickoff_ts:      i64,
    pub status:          PoolStatus,
    pub total_home:      u64,
    pub total_draw:      u64,
    pub total_away:      u64,
    pub total_pool:      u64,
    pub winning_outcome: Option<u8>,
}

impl Pool {
    // 8 discriminator + 4+32 string + 32+32 pubkeys + 1+1 bumps
    // + 8 kickoff + 1 status + 8*3 totals + 8 total + 1+1 option
    pub const LEN: usize = 8 + (4 + 32) + 32 + 32 + 1 + 1 + 8 + 1 + 8 + 8 + 8 + 8 + 2;
}

#[account]
pub struct Prediction {
    pub pool:    Pubkey,
    pub user:    Pubkey,
    pub outcome: u8,
    pub amount:  u64,
    pub claimed: bool,
    pub bump:    u8,
}

impl Prediction {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 8 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum PoolStatus {
    Open,
    Settled,
}

// ─── Events ──────────────────────────────────────────────────────────────────

#[event]
pub struct PoolCreated   { pub match_id: String, pub authority: Pubkey }
#[event]
pub struct PredictionPlaced { pub match_id: String, pub user: Pubkey, pub outcome: u8, pub amount: u64 }
#[event]
pub struct PoolSettled   { pub match_id: String, pub winning_outcome: u8, pub total_pool: u64 }
#[event]
pub struct PayoutClaimed { pub match_id: String, pub user: Pubkey, pub amount: u64 }

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum BozError {
    #[msg("Pool is not open for predictions")]
    PoolNotOpen,
    #[msg("Pool is not settled yet")]
    NotSettled,
    #[msg("Invalid outcome — must be 0 (HOME), 1 (DRAW), or 2 (AWAY)")]
    InvalidOutcome,
    #[msg("Amount below minimum (1 USDC)")]
    BelowMinimum,
    #[msg("Prediction already claimed")]
    AlreadyClaimed,
    #[msg("This prediction did not win")]
    DidNotWin,
    #[msg("Unauthorized — not pool authority")]
    Unauthorized,
    #[msg("Invalid pool state")]
    InvalidPool,
}
