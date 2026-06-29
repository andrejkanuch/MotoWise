import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { GRAPHQL_SDL_FILE_HEADER, GraphQLSchemaHost } from '@nestjs/graphql';
import { printSchema } from 'graphql';
import { AppModule } from '../src/app.module';

async function generateSchema() {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();

  const { schema } = app.get(GraphQLSchemaHost);
  // Prepend the same header the dev-runtime SDL emitter writes (autoSchemaFile),
  // so this standalone script and `pnpm dev` produce a byte-identical schema.graphql
  // and `generate:schema` never re-strips the "AUTOMATICALLY GENERATED" header.
  const sdl = GRAPHQL_SDL_FILE_HEADER + printSchema(schema);
  writeFileSync(join(process.cwd(), 'schema.graphql'), sdl);
  console.log('Schema written to schema.graphql');

  await app.close();
}

generateSchema();
