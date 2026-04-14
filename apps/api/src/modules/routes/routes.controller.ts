import { Controller } from '@nestjs/common';

/**
 * REST controller for routes.
 * GPX export was removed — all exports go through the authenticated
 * GraphQL `exportRouteGPX` mutation (with entitlement + quota checks).
 */
@Controller('routes')
export class RoutesController {}
