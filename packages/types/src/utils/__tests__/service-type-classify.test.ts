import { describe, expect, it } from 'vitest';
import { MaintenanceServiceType } from '../../constants/enums';
import { classifyServiceType } from '../service-type-classify';

describe('classifyServiceType', () => {
  it('classifies the OEM catalog top-10 free-text names', () => {
    expect(classifyServiceType('Brake Fluid')).toBe(MaintenanceServiceType.BRAKE_FLUID);
    expect(classifyServiceType('Tire Pressure Check')).toBe(MaintenanceServiceType.TIRE);
    expect(classifyServiceType('Fork Oil')).toBe(MaintenanceServiceType.FORK_OIL);
    expect(classifyServiceType('Brake Pads Inspection')).toBe(MaintenanceServiceType.BRAKE_PADS);
    expect(classifyServiceType('Oil & Filter Change')).toBe(MaintenanceServiceType.OIL_CHANGE);
    expect(classifyServiceType('Air Filter')).toBe(MaintenanceServiceType.AIR_FILTER);
    expect(classifyServiceType('Valve Clearance')).toBe(MaintenanceServiceType.VALVE_CLEARANCE);
    expect(classifyServiceType('Spark Plugs')).toBe(MaintenanceServiceType.SPARK_PLUG);
    expect(classifyServiceType('Coolant')).toBe(MaintenanceServiceType.COOLANT);
    expect(classifyServiceType('Chain Clean & Lube')).toBe(MaintenanceServiceType.CHAIN);
  });

  it("classifies the Spanish Honda invoice's line items", () => {
    // Order-sensitive: DCT change wins over the oil-filter keyword in the same line.
    expect(classifyServiceType('FILTRO DE ACEITE MOTOR Y CAMBIO DCT')).toBe(
      MaintenanceServiceType.TRANSMISSION_OIL,
    );
    // Standalone oil filter must not fall through to the broad oil-change rule.
    expect(classifyServiceType('FILTRO DE ACEITE MOTOR(WAKO)')).toBe(
      MaintenanceServiceType.OIL_FILTER,
    );
    expect(classifyServiceType('ULTRA DOT 4 BRAKE FLUID')).toBe(MaintenanceServiceType.BRAKE_FLUID);
    expect(classifyServiceType('ACEITE MOTOR 4T HGO 10W-30 MA')).toBe(
      MaintenanceServiceType.OIL_CHANGE,
    );
    expect(classifyServiceType('MANO DE OBRA REVISION MANTENIMIENTO')).toBe(
      MaintenanceServiceType.GENERAL_SERVICE,
    );
  });

  it('is accent- and case-insensitive', () => {
    expect(classifyServiceType('Revisión')).toBe(MaintenanceServiceType.GENERAL_SERVICE);
    expect(classifyServiceType('BUJÍA')).toBe(MaintenanceServiceType.SPARK_PLUG);
    expect(classifyServiceType('neumático')).toBe(MaintenanceServiceType.TIRE);
  });

  it('classifies additional canonical types', () => {
    expect(classifyServiceType('Final Drive Oil')).toBe(MaintenanceServiceType.FINAL_DRIVE);
    expect(classifyServiceType('Timing Belt')).toBe(MaintenanceServiceType.BELT);
    expect(classifyServiceType('Battery Health Check')).toBe(MaintenanceServiceType.BATTERY);
    // "primary" is drivetrain-scoped: real Harley primary lubricant classifies,
    // but a bare "primary" token must NOT be swallowed into transmission.
    expect(classifyServiceType('Primary Oil')).toBe(MaintenanceServiceType.TRANSMISSION_OIL);
    expect(classifyServiceType('Primary widget')).toBe(MaintenanceServiceType.OTHER);
  });

  it('falls through to OTHER for unrecognized, blank, or nullish input (never throws)', () => {
    expect(classifyServiceType('JUNTA TORICA 39.8X2.2')).toBe(MaintenanceServiceType.OTHER);
    expect(classifyServiceType('ARANDELA, TAPON DRENAJE 12MM')).toBe(MaintenanceServiceType.OTHER);
    expect(classifyServiceType('')).toBe(MaintenanceServiceType.OTHER);
    expect(classifyServiceType(null)).toBe(MaintenanceServiceType.OTHER);
    expect(classifyServiceType(undefined)).toBe(MaintenanceServiceType.OTHER);
  });
});
