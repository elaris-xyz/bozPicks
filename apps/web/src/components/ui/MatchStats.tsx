import type { BozEvent } from '@bozpicks/shared';
import { IconBall, IconCard, IconSub } from './Icons';

type Stats = {
  homeGoals: number; awayGoals: number;
  homeYellow: number; awayYellow: number;
  homeRed: number; awayRed: number;
  homeSubs: number; awaySubs: number;
};

function calcStats(events: BozEvent[], homeTeam: string): Stats {
  const s: Stats = { homeGoals: 0, awayGoals: 0, homeYellow: 0, awayYellow: 0, homeRed: 0, awayRed: 0, homeSubs: 0, awaySubs: 0 };
  for (const e of events) {
    const isHome = !e.team || e.team === homeTeam;
    if (e.type === 'GOAL')         isHome ? s.homeGoals++   : s.awayGoals++;
    if (e.type === 'YELLOW_CARD')  isHome ? s.homeYellow++  : s.awayYellow++;
    if (e.type === 'RED_CARD')     isHome ? s.homeRed++     : s.awayRed++;
    if (e.type === 'SUBSTITUTION') isHome ? s.homeSubs++    : s.awaySubs++;
  }
  return s;
}

type Props = { events: BozEvent[]; homeTeam: string; awayTeam: string };

function StatRow({ label, home, away, icon, iconColor }: {
  label: string; home: number; away: number; icon: React.ReactNode; iconColor: string;
}) {
  const max = Math.max(home, away, 1);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span className="font-bold text-gray-200">{home}</span>
        <span className="uppercase tracking-widest inline-flex items-center gap-1.5">
          <span style={{ color: iconColor }}>{icon}</span> {label}
        </span>
        <span className="font-bold text-gray-200">{away}</span>
      </div>
      <div className="flex gap-1 h-1.5 rounded-full overflow-hidden">
        <div className="rounded-full transition-all" style={{ width: `${(home / max) * 50}%`, background: 'var(--green)', marginLeft: 'auto' }} />
        <div className="w-px flex-shrink-0" style={{ background: 'var(--glass-border)' }} />
        <div className="rounded-full transition-all" style={{ width: `${(away / max) * 50}%`, background: 'var(--blue)' }} />
      </div>
    </div>
  );
}

export function MatchStats({ events, homeTeam, awayTeam }: Props) {
  if (events.length === 0) return null;
  const s = calcStats(events, homeTeam);

  return (
    <div className="glass p-5">
      <p className="section-label mb-4">Match Stats</p>

      {/* Team labels */}
      <div className="flex justify-between text-xs font-bold mb-4">
        <span style={{ color: 'var(--green)' }}>{homeTeam}</span>
        <span style={{ color: 'var(--blue)' }}>{awayTeam}</span>
      </div>

      <div className="space-y-3">
        <StatRow label="Goals"     home={s.homeGoals}  away={s.awayGoals}  icon={<IconBall size={11} />} iconColor="var(--green)" />
        <StatRow label="Yellow"    home={s.homeYellow} away={s.awayYellow} icon={<IconCard size={10} />} iconColor="var(--amber)" />
        <StatRow label="Red Cards" home={s.homeRed}    away={s.awayRed}    icon={<IconCard size={10} />} iconColor="var(--red)" />
        <StatRow label="Subs"      home={s.homeSubs}   away={s.awaySubs}   icon={<IconSub size={11} />}  iconColor="#9ca3af" />
      </div>
    </div>
  );
}
