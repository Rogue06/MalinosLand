import { useEffect, useState } from 'preact/hooks';
import type { FunctionComponent } from 'preact';
import { profileStore } from '../services/profile';
import { isSmallScreen } from '../services/device';
import { decorEditorStore, panelStore } from '../state';
import { useStore } from './hooks';
import { Chat } from './hud/Chat';
import { InvitationCard } from './hud/Invitations';
import { Minimap } from './hud/Minimap';
import { Objectives } from './hud/Objectives';
import { DialogBox, Hint, Stats, Toasts } from './hud/Overlays';
import { TodayCard } from './hud/Today';
import { TopBar } from './hud/TopBar';
import { Onboarding } from './Onboarding';
import { FeedbackPanel, ModerationPanel, PlayersPanel } from './panels/Community';
import { ActivitiesPanel } from './panels/Activities';
import { CarnetPanel } from './panels/Carnet';
import { MuseumPanel } from './panels/Museum';
import { CreationsPanel, ProjectPanel } from './panels/MuseumVisit';
import { QuizPanel } from './panels/Quiz';
import { ElevatorPanel, HomePanel } from './panels/Homes';
import {
  AvatarPanel,
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
    case 'home':
      return <HomePanel />;
    case 'carnet':
      return <CarnetPanel />;
    case 'activities':
      return <ActivitiesPanel />;
    case 'quiz':
      return <QuizPanel />;
    case 'museum':
      return <MuseumPanel />;
    case 'creations':
      return <CreationsPanel />;
    case 'project':
      return <ProjectPanel />;
    default:
      return null;
  }
}

/** Barre de l'éditeur de décoration : téléchargée seulement la première fois qu'on décore. */
function DecorBarLoader() {
  const active = useStore(decorEditorStore).active;
  const [Bar, setBar] = useState<FunctionComponent | null>(null);
  useEffect(() => {
    if (active && !Bar) void import('./hud/DecorBar').then((m) => setBar(() => m.DecorBar));
  }, [active, Bar]);
  return active && Bar ? <Bar /> : null;
}

export function App() {
  const profile = useStore(profileStore);
  const editing = useStore(decorEditorStore).active;
  // Petits écrans : la liste d'objectifs est repliée au départ (bouton 🎯 pour l'ouvrir).
  const [objectives, setObjectives] = useState(() => !isSmallScreen());
  // Petits écrans : chat replié au départ (dernier message + saisie), pour voir le monde.
  const [chatOpen, setChatOpen] = useState(() => !isSmallScreen());
  if (!profile) return <Onboarding />;
  return (
    <div class={`hud${chatOpen ? ' chat-open' : ''}${editing ? ' editing' : ''}`}>
      <TopBar objectivesOpen={objectives} onToggleObjectives={() => setObjectives(!objectives)} />
      {objectives && <Objectives onClose={() => setObjectives(false)} />}
      <TodayCard />
      <Toasts />
      <Minimap />
      <Chat open={chatOpen} onToggle={setChatOpen} />
      <Hint />
      <Stats />
      <DialogBox />
      <InvitationCard />
      <DecorBarLoader />
      <ActivePanel />
    </div>
  );
}
