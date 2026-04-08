import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RoutesService } from './routes.service';

@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get(':id/export.gpx')
  async exportGpx(@Param('id') id: string, @Res() res: Response) {
    const { gpx, filename } = await this.routesService.exportRouteGPX(id);

    res.set({
      'Content-Type': 'application/gpx+xml',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(gpx);
  }
}
