import { useState } from 'preact/hooks';
import { profileStore } from '../services/profile';
import { isSmallScreen } from '../services/device';
import { panelStore } from '../state';
import { useStore } from './hooks';
import { Chat } from './hud/Chat';
import { Minimap } from './hud/Minimap';
import { Objectives } from './hud/Objectives';
import { DialogBox, Hint, Stats, Toasts } from './hud/Overlays';
import { TopBar } from './hud/TopBar';
import { Onboarding } from './Onboarding';
import { FeedbackPanel, ModerationPanel, PlayersPanel } from './panels/Community';
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
    case 'ideas':
      return <FeedbackPanel kind="idee" />;
    case 'bugs':
      return <FeedbackPanel kind="bug" />;
    default:
      return null;
  }
}

export function App() {
  const profile = useStore(profileStore);
  // Petits écrans : la liste d'objectifs est repliée au départ (bouton 🎯 pour l'ouvrir).
  const [objectives, setObjectives] = useState(() => !isSmallScreen());
  // Petits écrans : chat replié au départ (dernier message + saisie), pour voir le monde.
  const [chatOpen, setChatOpen] = useState(() => !isSmallScreen());
  if (!profile) return <Onboarding />;
  return (
    <div class={`hud${chatOpen ? ' chat-open' : ''}`}>
      <TopBar objectivesOpen={objectives} onToggleObjectives={() => setObjectives(!objectives)} />
      {objectives && <Objectives onClose={() => setObjectives(false)} />}
      <Toasts />
      <Minimap />
      <Chat open={chatOpen} onToggle={setChatOpen} />
      <Hint />
      <Stats />
      <DialogBox />
      <ActivePanel />
    </div>
  );
}
