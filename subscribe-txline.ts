/**
 * TxLINE Free Tier Subscription — Mainnet
 * Service Level 12: World Cup real-time data (free, no TxL tokens)
 *
 * Run: npx tsx subscribe-txline.ts
 * Requires: ANCHOR_WALLET env var pointing to your keypair JSON file
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Connection, Keypair } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as nacl from "tweetnacl";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";

// ─── Mainnet constants ───────────────────────────────────────────────────────
const PROGRAM_ID     = new PublicKey("9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA");
const TXL_TOKEN_MINT = new PublicKey("Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL");
const API_BASE       = "https://txline.txodds.com";

const SERVICE_LEVEL_ID  = 12;  // real-time World Cup
const DURATION_WEEKS    = 4;
const SELECTED_LEAGUES: number[] = [];  // empty = standard bundle

// ─── Load keypair ────────────────────────────────────────────────────────────
function loadKeypair(filePath: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main() {
  console.log("\n=== TxLINE Free Tier Subscription (Mainnet) ===\n");

  // Load wallet
  const keypairPath = process.env.ANCHOR_WALLET
    ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? ".", ".config/solana/id.json");

  if (!fs.existsSync(keypairPath)) {
    console.error(`Keypair not found at: ${keypairPath}`);
    console.log("Create one with: solana-keygen new -o ~/.config/solana/id.json");
    console.log("Or set ANCHOR_WALLET=path/to/keypair.json");
    process.exit(1);
  }

  const keypair = loadKeypair(keypairPath);
  console.log("Wallet:", keypair.publicKey.toBase58());

  // Check SOL balance
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  const balance = await connection.getBalance(keypair.publicKey);
  console.log("SOL balance:", balance / 1e9, "SOL");

  if (balance < 10_000) {
    console.error("\n❌ Need at least 0.00001 SOL for transaction fees");
    console.log("Send a small amount of SOL to:", keypair.publicKey.toBase58());
    process.exit(1);
  }

  // Set up Anchor provider
  const wallet = new anchor.Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  // Load IDL from cloned repo
  const idlPath = path.join(__dirname, "tmp-txodds/idl/txoracle.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  const program = new Program(idl, provider);

  // Derive PDAs
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")], PROGRAM_ID
  );
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")], PROGRAM_ID
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    TXL_TOKEN_MINT, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID
  );

  // Get/create user token account (needed even for free tier)
  console.log("\nSetting up token account...");
  const userTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    keypair,
    TXL_TOKEN_MINT,
    keypair.publicKey,
    false,
    "confirmed",
    undefined,
    TOKEN_2022_PROGRAM_ID
  );
  console.log("Token account:", userTokenAccount.address.toBase58());

  // Guest JWT
  console.log("\nGetting guest JWT...");
  const authRes = await axios.post(`${API_BASE}/auth/guest/start`);
  const jwt = authRes.data.token;
  console.log("JWT: OK ✓");

  // On-chain subscription (free — no TxL tokens transferred)
  console.log(`\nSubscribing on-chain (Service Level ${SERVICE_LEVEL_ID}, ${DURATION_WEEKS} weeks)...`);

  const txSig = await (program.methods as any)
    .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
    .accounts({
      user: keypair.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: TXL_TOKEN_MINT,
      userTokenAccount: userTokenAccount.address,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("✅ Transaction:", txSig);
  console.log("   Explorer:", `https://explorer.solana.com/tx/${txSig}`);

  // Sign activation message
  const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
  const msgBytes = new TextEncoder().encode(messageString);
  const sigBytes = nacl.sign.detached(msgBytes, keypair.secretKey);
  const walletSignature = Buffer.from(sigBytes).toString("base64");

  // Activate API token
  console.log("\nActivating API token...");
  const activateRes = await axios.post(
    `${API_BASE}/api/token/activate`,
    { txSig, walletSignature, leagues: SELECTED_LEAGUES },
    { headers: { Authorization: `Bearer ${jwt}` } }
  );

  const apiToken = activateRes.data.token ?? activateRes.data;
  console.log("✅ API Token:", apiToken);

  // Save to .env
  const envPath = path.join(__dirname, ".env");
  let env = fs.readFileSync(envPath, "utf8");
  env = env.replace(/TXLINE_API_KEY=.*/, `TXLINE_API_KEY=${apiToken}`);
  fs.writeFileSync(envPath, env);
  console.log("✅ Saved to .env\n");

  console.log("═".repeat(60));
  console.log("bozPicks is ready to connect to TxLINE!");
  console.log("Run: pnpm --filter=ingest dev");
  console.log("═".repeat(60));
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message ?? err);
  process.exit(1);
});
