import { BadRequestException, Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RoutesService } from './routes.service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get(':id/export.gpx')
  async exportGpx(@Param('id') id: string, @Res() res: Response) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid route ID');
    }

    const { gpx, filename } = await this.routesService.exportRouteGPX(id);

    res.set({
      'Content-Type': 'application/gpx+xml',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(gpx);
  }
}
