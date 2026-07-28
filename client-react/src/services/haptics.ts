import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

function ignoreUnsupported(result: Promise<void>) {
  void result.catch(() => undefined);
}

export function playTapFeedback() {
  ignoreUnsupported(Haptics.impact({ style: ImpactStyle.Light }));
}

export function playQuickAdjustmentFeedback() {
  ignoreUnsupported(Haptics.impact({ style: ImpactStyle.Medium }));
}

export function playUndoFeedback() {
  ignoreUnsupported(Haptics.impact({ style: ImpactStyle.Medium }));
}

export function playEliminationWarning() {
  ignoreUnsupported(Haptics.notification({ type: NotificationType.Warning }));
}
