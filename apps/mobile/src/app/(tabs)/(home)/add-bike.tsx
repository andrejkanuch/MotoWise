// Home's own copy of the garage add-bike sheet, so a sheet opened from
// Home lives in the Home stack: Cancel/Save pop it there instead of
// leaving it open on the Garage tab's stack (cross-tab push + router.back()
// left a ghost sheet).
export { default } from '../(garage)/add-bike';
