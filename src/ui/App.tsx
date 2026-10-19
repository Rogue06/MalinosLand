import { useState } from 'preact/hooks';
import { profileStore } from '../services/profile';
import { panelStore } from '../state';
import { useStore } from './hooks';
import { Chat } from './hud/Chat';
import { Minimap } from './hud/Minimap';
import { Objectives } from './hud/Objectives';
import { DialogBox, Hint, Stats, Toasts } from './hud/Overlays';
import { TopBar } from './hud/TopBar';
import { Onboarding } from './Onboarding';
import { ModerationPanel, PlayersPanel } from './panels/Community';
import {
  AvatarPanel,
  ElevatorPanel,
  EventsPanel,
  HelpPanel,
  RoadmapPanel,
  SettingsPanel,
  TipsPanel,
  WelcomePanel,
} from './panels/Panels';

function ActivePanel() {
  const panel = useStore(panelStore);
  switch (panel) {
    case 'welcome':
      return <WelcomePanel />;
    case 'roadmap':
      return <RoadmapPanel />;
    case 'elevator':
      return <ElevatorPanel />;
    case 'tips':
      return <TipsPanel />;
    case 'events':
      return <EventsPanel />;
    case 'avatar':
      return <AvatarPanel />;
    case 'settings':
      return <SettingsPanel />;
    case 'help':
      return <HelpPanel />;
    case 'players':
      return <PlayersPanel />;
    case 'moderation':
      return <ModerationPanel />;
    default:
      return null;
  }
}

export function App() {
  const profile = useStore(profileStore);
  // Petits écrans : la liste d'objectifs est repliée au départ (bouton 🎯 pour l'ouvrir).
  const [objectives, setObjectives] = useState(
    () => typeof window === 'undefined' || window.innerWidth > 760,
  );
  if (!profile) return <Onboarding />;
  return (
    <div class="hud">
      <TopBar objectivesOpen={objectives} onToggleObjectives={() => setObjectives(!objectives)} />
      {objectives && <Objectives onClose={() => setObjectives(false)} />}
      <Toasts />
      <Minimap />
      <Chat />
      <Hint />
      <Stats />
      <DialogBox />
      <ActivePanel />
    </div>
  );
}
