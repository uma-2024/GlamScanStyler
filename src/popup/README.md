# App popup queue

`PopupProvider` owns one display layer for GlamScanStyler. Use `QueuedModal`
instead of importing `Modal` from React Native, and `QueuedAlert.alert` instead
of `Alert.alert`. `CustomModal` already uses this queue.

- Independent visible modals wait in order. Updating their content keeps their place.
- Hiding or unmounting a modal cancels its request. The display layer is removed
  when the queue is empty, so it cannot intercept screen touches afterward.
- Nested modals and custom feedback temporarily replace the parent dialog's
  content, preserving its mounted form. Closing a parent cancels its feedback.
- `onPresent` runs when a popup first gets its turn. Use it for entrance animations.
  `onActiveChange` also reports when nested feedback hides or reveals it; use this
  for timers that must run only while the popup is visible.
- Keep custom animations in the popup content. The shared layer does not perform
  native `Modal` presentations or native slide/fade transitions.
- Device-owned permission prompts, payment sheets, and media pickers retain their
  native behavior.

The provider is reset when the signed-in user changes. A modal outside the provider
falls back to React Native for standalone screen previews and existing isolated tests.
