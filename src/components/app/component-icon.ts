import { CircuitBoard, Cylinder, Fan, Gauge, Lightbulb, Package, Plug, Settings, Thermometer, ToggleRight, type LucideIcon } from 'lucide-react';
import type { BOMComponent } from '@/types';

export const COMPONENT_ICONS: Record<BOMComponent['type'], LucideIcon> = {
  COMPRESSOR: Gauge,
  EVAPORATOR: Thermometer,
  CONTROLLER: CircuitBoard,
  FAN_MOTOR: Fan,
  CONTACTOR: ToggleRight,
  REFRIGERANT: Cylinder,
  PACKAGED_UNIT: Package,
  LIGHTS: Lightbulb,
  ACCESSORY: Plug,
  OTHER: Settings,
};
