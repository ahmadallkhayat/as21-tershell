import { createPortal } from 'react-dom'
import type { LeafPane } from './paneTree'
import type { PaneActions } from './PaneView'
import type { Settings, ShellProfile } from './settings'
import { useSlotElement } from './paneSlots'
import TerminalView from './TerminalView'

interface Props {
  leaf: LeafPane
  tabActive: boolean
  focused: boolean
  isSplit: boolean
  /** Set only when the pane's shellKey names a user-defined profile; the
   * main process only knows about the ones it detected itself. */
  customProfile?: ShellProfile
  settings: Settings
  actions: PaneActions
}

/**
 * Portals one TerminalView into the DOM slot PaneView currently has
 * registered for this pane id (see paneSlots.ts). Rendered once per leaf
 * pane, flat, keyed by pane id, at the App level — entirely outside the
 * recursive pane tree — so splitting/closing sibling panes never affects
 * this component's identity and never remounts the terminal inside it.
 */
export default function TerminalHost({
  leaf,
  tabActive,
  focused,
  isSplit,
  customProfile,
  settings,
  actions
}: Props): JSX.Element | null {
  const slot = useSlotElement(leaf.id)
  if (!slot) return null

  return createPortal(
    <TerminalView
      paneId={leaf.id}
      shellKey={leaf.shellKey}
      initialCommand={leaf.initialCommand}
      cwd={leaf.cwd}
      customProfile={customProfile}
      visible={tabActive}
      focused={focused}
      isSplit={isSplit}
      settings={settings}
      onExit={() => actions.onExit(leaf.id)}
      onTitleChange={(title) => actions.onTitleChange(leaf.id, title)}
      onNewTab={actions.onNewTab}
      onCloseTab={() => actions.onClosePane(leaf.id)}
      onNextTab={actions.onNextTab}
      onPrevTab={actions.onPrevTab}
      onSelectTabIndex={actions.onSelectTabIndex}
      onSplitRight={() => actions.onSplitRight(leaf.id)}
      onSplitDown={() => actions.onSplitDown(leaf.id)}
      onFocusAdjacent={actions.onFocusAdjacent}
      onZoom={actions.onZoom}
    />,
    slot
  )
}
