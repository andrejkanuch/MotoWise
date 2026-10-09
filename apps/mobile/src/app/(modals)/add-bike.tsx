// The modal stack's own copy of the garage add-bike sheet. Receipt scan is a
// root modal; its "Add a bike" opens this one on top of it, so Save/Cancel
// (router.back()) return to the scan review instead of leaving a ghost sheet
// on the Garage tab's stack.
export { default } from '../(tabs)/(garage)/add-bike';
