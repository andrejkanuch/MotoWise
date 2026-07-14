const { withGradleProperties } = require('expo/config-plugins');

/**
 * Raise the Gradle daemon's JVM memory limits in android/gradle.properties.
 *
 * The default expo-build-properties output caps the daemon at
 *   -Xmx2048m -XX:MaxMetaspaceSize=512m
 * which is not enough for a release build of this app (R8 minification +
 * resource shrinking + the new architecture). Local Android builds fail with:
 *   "Gradle build daemon has been stopped: since the JVM garbage collector is
 *    thrashing and after running out of JVM Metaspace"
 *
 * expo-build-properties (SDK 56) has no field for org.gradle.jvmargs, and the
 * android/ dir is gitignored + regenerated on every prebuild, so we set it here
 * with the withGradleProperties mod. It survives prebuild regeneration.
 *
 * Sized for a dev machine with ample RAM; still well under a 16 GB box.
 */
const JVM_ARGS =
  '-Xmx6144m -XX:MaxMetaspaceSize=2048m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8';

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;
    const existing = props.find(
      (item) => item.type === 'property' && item.key === 'org.gradle.jvmargs',
    );

    if (existing) {
      existing.value = JVM_ARGS;
    } else {
      props.push({ type: 'property', key: 'org.gradle.jvmargs', value: JVM_ARGS });
    }

    return config;
  });
};
