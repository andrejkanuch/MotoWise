import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: '../../apps/api/schema.graphql',
  documents: [
    '../../apps/mobile/src/graphql/**/*.graphql',
    '../../apps/web/src/graphql/**/*.graphql',
  ],
  generates: {
    './src/generated/': {
      preset: 'client',
      presetConfig: {
        fragmentMasking: false,
      },
      config: {
        useTypeImports: true,
        // client-preset 6 defaults to string-literal unions; apps use the
        // enums as runtime values (MaintenanceTaskStatus.Done, ...).
        enumType: 'native',
        scalars: {
          UUID: 'string',
          DateTime: 'string',
          JSON: 'Record<string, unknown>',
        },
      },
    },
  },
};

export default config;
