// Verifies the adapter's contract over @iternio/react-native-auto-play: it
// rebuilds + re-pushes the InformationTemplate only when the title or actions
// change, and updates rows in place otherwise. This is the crux of the Iternio
// adoption and the part CI can actually exercise (the native render cannot).

// Spies are defined INSIDE the factory (and exposed on the mock module) because
// the preset resolves @iternio before module-scope consts initialize, so captured
// refs would be undefined. The test reads them back off the imported mock.
// The adapter now routes native-call rejections to captureException; mock it so
// the (real) analytics chain isn't pulled into the unit test.
jest.mock('../../../../src/lib/analytics', () => ({ captureException: jest.fn() }));

jest.mock('@iternio/react-native-auto-play', () => {
  // Return resolved promises: setRootTemplate/updateItems are Promise<void> and the
  // adapter attaches a .catch, so a non-thenable mock would throw at the call site.
  const setRootTemplate = jest.fn(() => Promise.resolve());
  const updateItems = jest.fn(() => Promise.resolve());
  const push = jest.fn(() => Promise.resolve());
  const updateSections = jest.fn(() => Promise.resolve());
  const popTemplate = jest.fn(() => Promise.resolve());
  // biome-ignore lint/suspicious/noExplicitAny: captured template configs for assertions
  const ctorCalls: any[] = [];
  // biome-ignore lint/suspicious/noExplicitAny: captured list configs for assertions
  const listCtorCalls: any[] = [];
  return {
    __ctorCalls: ctorCalls,
    __listCtorCalls: listCtorCalls,
    __setRootTemplate: setRootTemplate,
    __updateItems: updateItems,
    __push: push,
    __updateSections: updateSections,
    __popTemplate: popTemplate,
    InformationTemplate: class {
      // biome-ignore lint/suspicious/noExplicitAny: test double mirrors the lib config
      constructor(config: any) {
        ctorCalls.push(config);
      }
      setRootTemplate = setRootTemplate;
      updateItems = updateItems;
    },
    ListTemplate: class {
      // biome-ignore lint/suspicious/noExplicitAny: test double mirrors the lib config
      constructor(config: any) {
        listCtorCalls.push(config);
      }
      push = push;
      updateSections = updateSections;
    },
    HybridAutoPlay: {
      addListener: jest.fn(() => jest.fn()),
      isConnected: jest.fn(() => false),
      popTemplate,
    },
  };
});

import type { CPInformationTemplateModel } from '../index';
import {
  addConnectListener,
  clearInformation,
  isCarPlayAvailable,
  isHeadUnitConnected,
  popBikeList,
  pushBikeList,
  renderInformation,
  setActionDispatcher,
} from '../index';

// biome-ignore lint/suspicious/noExplicitAny: reaching into the mock's test hooks
const lib = require('@iternio/react-native-auto-play') as any;
const ctorCalls: unknown[] = lib.__ctorCalls;
const setRoot = lib.__setRootTemplate as jest.Mock;
const updateItems = lib.__updateItems as jest.Mock;
const addListener = lib.HybridAutoPlay.addListener as jest.Mock;
const isConnected = lib.HybridAutoPlay.isConnected as jest.Mock;
const listCtorCalls: unknown[] = lib.__listCtorCalls;
const push = lib.__push as jest.Mock;
const updateSections = lib.__updateSections as jest.Mock;
const popTemplate = lib.__popTemplate as jest.Mock;
const captureException = require('../../../../src/lib/analytics').captureException as jest.Mock;

const model = (over: Partial<CPInformationTemplateModel> = {}): CPInformationTemplateModel => ({
  title: 'RECORDING',
  items: [
    { title: 'Distance', detail: '42.3 km' },
    { title: 'Moving', detail: '1:12' },
  ],
  actions: [
    { id: 'pause', title: 'Pause' },
    { id: 'stop', title: 'Stop' },
  ],
  ...over,
});

beforeEach(() => {
  setRoot.mockClear();
  updateItems.mockClear();
  addListener.mockClear();
  isConnected.mockReset().mockReturnValue(false);
  captureException.mockClear();
  push.mockClear();
  updateSections.mockClear();
  popTemplate.mockClear();
  ctorCalls.length = 0;
  listCtorCalls.length = 0;
  popBikeList(); // drop any pushed list reference between tests
  popTemplate.mockClear(); // ignore the pop the reset above may have triggered
  clearInformation(); // reset the adapter's push-vs-update state between tests
});

describe('carplay adapter', () => {
  it('loads the iOS library (available)', () => {
    expect(isCarPlayAvailable).toBe(true);
  });

  it('builds + pushes a root template on the first render', () => {
    renderInformation(model());
    expect(ctorCalls).toHaveLength(1);
    expect(setRoot).toHaveBeenCalledTimes(1);
    expect(updateItems).not.toHaveBeenCalled();
  });

  it('updates rows in place when only the detail changes (same title + actions)', () => {
    renderInformation(model());
    ctorCalls.length = 0;
    setRoot.mockClear();

    renderInformation(model({ items: [{ title: 'Distance', detail: '42.9 km' }] }));
    expect(ctorCalls).toHaveLength(0);
    expect(setRoot).not.toHaveBeenCalled();
    expect(updateItems).toHaveBeenCalledTimes(1);
  });

  it('rebuilds + re-pushes when the title changes', () => {
    renderInformation(model());
    ctorCalls.length = 0;
    setRoot.mockClear();

    renderInformation(model({ title: 'AUTO-PAUSED' }));
    expect(ctorCalls).toHaveLength(1);
    expect(setRoot).toHaveBeenCalledTimes(1);
  });

  it('rebuilds + re-pushes when the action set changes', () => {
    renderInformation(model());
    ctorCalls.length = 0;
    setRoot.mockClear();

    renderInformation(model({ actions: [{ id: 'resume', title: 'Resume' }] }));
    expect(ctorCalls).toHaveLength(1);
    expect(setRoot).toHaveBeenCalledTimes(1);
  });

  it('rebuilds after clearInformation (reconnect)', () => {
    renderInformation(model());
    clearInformation();
    ctorCalls.length = 0;
    setRoot.mockClear();

    renderInformation(model()); // identical model, but the ref was dropped
    expect(ctorCalls).toHaveLength(1);
    expect(setRoot).toHaveBeenCalledTimes(1);
  });

  it('routes a button press through the injected dispatcher', () => {
    const dispatch = jest.fn();
    setActionDispatcher(dispatch);
    renderInformation(model());

    // pull the wired onPress off the last template config the lib received
    // biome-ignore lint/suspicious/noExplicitAny: mock config shape
    const config = ctorCalls.at(-1) as any;
    config.actions.ios[1].onPress();
    expect(dispatch).toHaveBeenCalledWith('stop');
  });

  it('wraps the head-unit connection + listeners', () => {
    isConnected.mockReturnValueOnce(true);
    expect(isHeadUnitConnected()).toBe(true);

    const sub = addConnectListener(jest.fn());
    expect(addListener).toHaveBeenCalledWith('didConnect', expect.any(Function));
    sub?.remove();
  });

  it('falls back to a single placeholder row when given no items (never an empty tuple)', () => {
    // InformationItems is a min-1 tuple; pushing [] would be an invalid native
    // template. The adapter must substitute one dash row instead.
    renderInformation(model({ items: [] }));
    expect(ctorCalls).toHaveLength(1);
    // biome-ignore lint/suspicious/noExplicitAny: mock config shape
    const config = ctorCalls.at(-1) as any;
    expect(config.items).toHaveLength(1);
    expect(setRoot).toHaveBeenCalledTimes(1);
  });

  it('reports a native setRootTemplate rejection to Sentry instead of swallowing it', async () => {
    setRoot.mockRejectedValueOnce(new Error('native push failed'));
    renderInformation(model());
    await Promise.resolve(); // flush the fire-and-forget .catch microtask
    await Promise.resolve();
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ source: 'carplay.setRootTemplate' }),
    );
  });

  // --- Bike-status list (pushed secondary template) ---

  it('builds + pushes a ListTemplate on first pushBikeList, updates in place on the next', () => {
    const rows = [{ title: 'Mileage', detail: '16,000 km' }];
    pushBikeList({ title: 'Bike', rows });
    expect(listCtorCalls).toHaveLength(1);
    expect(push).toHaveBeenCalledTimes(1);
    expect(updateSections).not.toHaveBeenCalled();

    pushBikeList({ title: 'Bike', rows: [{ title: 'Recalls', detail: '0' }] });
    expect(listCtorCalls).toHaveLength(1); // no second construct
    expect(push).toHaveBeenCalledTimes(1);
    expect(updateSections).toHaveBeenCalledTimes(1); // updated in place
  });

  it('forwards onWillAppear and fires onDidDisappear on pop', () => {
    const onWillAppear = jest.fn();
    const onDidDisappear = jest.fn();
    pushBikeList(
      { title: 'Bike', rows: [{ title: 'Mileage', detail: '—' }] },
      { onWillAppear, onDidDisappear },
    );
    // biome-ignore lint/suspicious/noExplicitAny: mock config shape
    const config = listCtorCalls.at(-1) as any;
    config.onWillAppear();
    expect(onWillAppear).toHaveBeenCalledTimes(1);
    config.onDidDisappear();
    expect(onDidDisappear).toHaveBeenCalledTimes(1);
  });

  it('falls back to a single placeholder row when the list has no rows', () => {
    pushBikeList({ title: 'Bike', rows: [] });
    // biome-ignore lint/suspicious/noExplicitAny: mock config shape
    const config = listCtorCalls.at(-1) as any;
    expect(config.sections.items).toHaveLength(1);
  });

  it('popBikeList pops the template and no-ops when nothing is pushed', () => {
    popBikeList(); // nothing pushed
    expect(popTemplate).not.toHaveBeenCalled();

    pushBikeList({ title: 'Bike', rows: [{ title: 'Mileage', detail: '—' }] });
    popBikeList();
    expect(popTemplate).toHaveBeenCalledTimes(1);
  });
});
