// Shared types for the MotoVault CarPlay bridge. The JS coordinator builds these
// plain models; the Swift mapper turns them into CPInformationTemplate objects.

export interface CPInfoItem {
  title: string;
  detail: string;
}

export interface CPInfoAction {
  /** Stable id echoed back in the onActionPress event (e.g. 'start', 'stop'). */
  id: string;
  title: string;
}

export interface CPInformationTemplateModel {
  title: string;
  items: CPInfoItem[];
  actions: CPInfoAction[];
}

export interface CarPlayActionEvent {
  actionId: string;
}

export type CarPlayEventName = 'onConnect' | 'onDisconnect' | 'onActionPress';
