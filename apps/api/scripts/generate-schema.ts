import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { printSchema } from 'graphql';
import { AppModule } from '../src/app.module';

async function generateSchema() {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();

  const { schema } = app.get(GraphQLSchemaHost);
  const sdl = printSchema(schema);
  writeFileSync(join(process.cwd(), 'schema.graphql'), sdl);
  console.log('Schema written to schema.graphql');

  await app.close();
}

generateSchema();
