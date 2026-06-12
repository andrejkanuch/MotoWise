import { Field, Int, ObjectType } from '@nestjs/graphql';

/** One AI-authored, hedged "owners watch for" bullet. Flavor, never fact. */
@ObjectType()
export class RevealKnownIssue {
  @Field()
  title: string;

  @Field()
  detail: string;
}

/** AI-personalization block. `status` lets the client show/hide gracefully. */
@ObjectType()
export class RevealInsights {
  @Field({ description: "Generation status: 'pending' | 'ready' | 'failed'." })
  status: string;

  @Field(() => [RevealKnownIssue], {
    description: 'Hedged community observations. Empty unless status is "ready".',
  })
  knownIssues: RevealKnownIssue[];
}

/** A single open NHTSA recall (authoritative — sourced from NHTSA, never AI). */
@ObjectType()
export class RevealRecall {
  @Field()
  component: string;

  @Field()
  summary: string;
}

/**
 * Composed payload for the onboarding Reveal ("Bike Dossier"). Facts (recalls,
 * OEM task count, projected cost, rider count) come from authoritative sources;
 * only `insights` is AI-authored and hedged. A single round-trip behind B's
 * "Building your plan…" loader; A consumes the same query and ignores `insights`.
 */
@ObjectType()
export class OnboardingReveal {
  @Field(() => Int, { description: 'Year echoed back for client convenience.' })
  year: number;

  @Field()
  make: string;

  @Field({ nullable: true })
  model?: string;

  // --- Recalls (NHTSA) ---
  @Field(() => Int, { description: 'Open recall count. 0 is a positive, reassuring state.' })
  recallCount: number;

  @Field(() => [RevealRecall], { description: 'Open recalls (capped). Empty when none/unknown.' })
  recalls: RevealRecall[];

  @Field({
    description: 'False when recalls could not be checked (e.g. make-only capture, NHTSA down).',
  })
  recallsChecked: boolean;

  // --- Maintenance plan + projected cost (our data) ---
  @Field(() => Int, { description: 'Number of OEM scheduled tasks loaded for this bike.' })
  oemTaskCount: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Estimated first-year scheduled-service cost in EUR (hedged "about €X").',
  })
  projectedYearlyCostEur?: number;

  // --- Community (our stats) ---
  @Field(() => Int, { description: 'Riders on MotoVault with this make.' })
  riderCount: number;

  // --- AI flavor ---
  @Field(() => RevealInsights)
  insights: RevealInsights;
}
