import { Logger } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { Public } from '../../common/decorators/public.decorator';
import { MotorcyclesService } from '../motorcycles/motorcycles.service';
import { NhtsaService } from '../motorcycles/nhtsa.service';
import { OemSchedulesService } from '../oem-schedules/oem-schedules.service';
import { projectFirstYearCostEur } from './cost-projection';
import { ModelInsightsService } from './model-insights.service';
import { OnboardingReveal } from './models/onboarding-reveal.model';

/** Cap recalls returned to the client — the Reveal shows a count, not a list. */
const MAX_RECALLS_RETURNED = 5;

/**
 * Onboarding "Bike Dossier" Reveal. PUBLIC — onboarding users are anonymous
 * (no JWT, see auth-and-paywall-timing.md). All four facts come from
 * authoritative sources; `insights` is the only AI-authored, hedged block and
 * degrades to status 'pending'/'failed' (client hides the card) without ever
 * blocking the screen.
 */
@Resolver(() => OnboardingReveal)
export class OnboardingRevealResolver {
  private readonly logger = new Logger(OnboardingRevealResolver.name);

  constructor(
    private readonly modelInsights: ModelInsightsService,
    private readonly oemSchedules: OemSchedulesService,
    private readonly nhtsa: NhtsaService,
    private readonly motorcycles: MotorcyclesService,
  ) {}

  @Public()
  @Query(() => OnboardingReveal, {
    name: 'onboardingReveal',
    description:
      'Composed Bike Dossier for the onboarding Reveal (recalls, plan, cost, AI flavor).',
  })
  async onboardingReveal(
    @Args('make') make: string,
    @Args('year', { type: () => Int }) year: number,
    @Args('model', { nullable: true }) model?: string,
  ): Promise<OnboardingReveal> {
    // Fan out every source concurrently; each degrades independently so one
    // slow/failing source never holds up the others.
    const [recalls, schedules, riderCount, insights] = await Promise.all([
      this.safeRecalls(make, model, year),
      this.safeSchedules(make, model, year),
      this.safeRiderCount(make),
      this.safeInsights(make, model, year),
    ]);

    return {
      year,
      make,
      model: model ?? undefined,
      recallCount: recalls.checked ? recalls.list.length : 0,
      recalls: recalls.list.slice(0, MAX_RECALLS_RETURNED).map((r) => ({
        component: r.component,
        summary: r.summary,
      })),
      recallsChecked: recalls.checked,
      oemTaskCount: schedules.length,
      projectedYearlyCostEur: projectFirstYearCostEur(schedules) ?? undefined,
      riderCount,
      insights,
    };
  }

  /** Recalls need a model — make-only capture degrades to "not checked". */
  private async safeRecalls(make: string, model: string | undefined, year: number) {
    if (!model) return { checked: false, list: [] as { component: string; summary: string }[] };
    try {
      const list = await this.nhtsa.getRecalls({ make, model, year });
      return { checked: true, list };
    } catch (err) {
      this.logger.warn(`Reveal recalls lookup failed: ${(err as Error).message}`);
      return { checked: false, list: [] as { component: string; summary: string }[] };
    }
  }

  private async safeSchedules(make: string, model: string | undefined, year: number) {
    try {
      return await this.oemSchedules.findByMotorcycle(make, model ?? null, year, null);
    } catch (err) {
      this.logger.warn(`Reveal OEM lookup failed: ${(err as Error).message}`);
      return [];
    }
  }

  private async safeRiderCount(make: string): Promise<number> {
    try {
      const stats = await this.motorcycles.getMakeStats();
      const match = stats.find((s) => s.make.toLowerCase() === make.toLowerCase());
      return match?.riders ?? 0;
    } catch (err) {
      this.logger.warn(`Reveal rider count failed: ${(err as Error).message}`);
      return 0;
    }
  }

  private async safeInsights(make: string, model: string | undefined, year: number) {
    // No model → no per-model AI flavor; client hides the card.
    if (!model) return { status: 'failed', knownIssues: [] };
    try {
      const result = await this.modelInsights.getInsights({ make, model, year });
      return {
        status: result.status,
        knownIssues: result.payload?.knownIssues ?? [],
      };
    } catch (err) {
      this.logger.warn(`Reveal insights failed: ${(err as Error).message}`);
      return { status: 'failed', knownIssues: [] };
    }
  }
}
