import {
  type FingerprintableEvent,
  isMessageEvent,
  MESSAGE_FINGERPRINT_PREFIX,
  messageFingerprint,
} from '../sentry-message-grouping';

const SIGNOUT_MESSAGE = 'Sign-out with unsynced ride data — preserving sync queue';
const HYDRATION_MESSAGE = 'Auth hydration timeout — forcing app ready';

/**
 * A `captureMessage` event as Sentry hands it to `beforeSend`: no `exception`
 * payload, a string `message`, and a SYNTHETIC stacktrace bolted on because
 * `attachStacktrace` defaults to true in @sentry/react-native. `topFrame` is
 * what Sentry titled the resulting issue with — which is how one string ended up
 * as MOTO-VAULT-REACT-NATIVE-2T ("captureMessage") and -39 ("anonymous").
 */
function messageEvent(message: string, topFrame: string): FingerprintableEvent {
  return {
    message,
    threads: { values: [{ stacktrace: { frames: [{ function: topFrame }] } }] },
  } as FingerprintableEvent;
}

describe('isMessageEvent', () => {
  it('recognises a captureMessage event (string message, no exception)', () => {
    expect(isMessageEvent(messageEvent(SIGNOUT_MESSAGE, 'captureMessage'))).toBe(true);
  });

  it('rejects an exception event', () => {
    const event: FingerprintableEvent = {
      exception: { values: [{ type: 'TypeError', value: 'boom' }] },
    };
    expect(isMessageEvent(event)).toBe(false);
  });

  // Sentry attaches a `message` to some exception events too (e.g. a captured
  // exception with a custom message). Those must keep their exception grouping.
  it('rejects an exception event that also carries a message', () => {
    const event: FingerprintableEvent = {
      exception: { values: [{ type: 'TypeError', value: 'boom' }] },
      message: SIGNOUT_MESSAGE,
    };
    expect(isMessageEvent(event)).toBe(false);
  });

  it('rejects an event with neither an exception nor a string message', () => {
    expect(isMessageEvent({})).toBe(false);
    expect(isMessageEvent({ message: undefined })).toBe(false);
  });
});

describe('messageFingerprint', () => {
  // THE GROUPING PROOF: the message is the only input, so the synthetic stack
  // that used to fragment one signal across issues cannot affect the group.
  it('gives one message the same fingerprint regardless of the capturing stack', () => {
    const fromWrapper = messageEvent(SIGNOUT_MESSAGE, 'captureMessage');
    const fromListener = messageEvent(SIGNOUT_MESSAGE, 'anonymous');

    expect(messageFingerprint(fromWrapper.message as string)).toEqual(
      messageFingerprint(fromListener.message as string),
    );
  });

  it('gives different messages different fingerprints', () => {
    expect(messageFingerprint(SIGNOUT_MESSAGE)).not.toEqual(messageFingerprint(HYDRATION_MESSAGE));
  });

  it('namespaces the fingerprint so it can never collide with a GraphQL one', () => {
    expect(messageFingerprint(SIGNOUT_MESSAGE)[0]).toBe(MESSAGE_FINGERPRINT_PREFIX);
    expect(messageFingerprint(SIGNOUT_MESSAGE)).toEqual([
      MESSAGE_FINGERPRINT_PREFIX,
      SIGNOUT_MESSAGE,
    ]);
  });
});
