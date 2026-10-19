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
    default:
      return null;
  }
}

export function App() {
  const profile = useStore(profileStore);
  const [objectives, setObjectives] = useState(true);
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
