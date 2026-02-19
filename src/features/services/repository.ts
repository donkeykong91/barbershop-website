import crypto from 'crypto';

import { queryAll, queryOne, run } from '../../lib/db/sqlite';
import type { Service } from './types';

type ListServicesOptions = {
  includeInactive?: boolean;
  includeHidden?: boolean;
};

type ServiceRow = {
  id: string;
  name: string;
  description: string;
  duration_min: number;
  price_cents: number;
  currency: 'USD';
  active: 0 | 1;
  visible: 0 | 1;
  bookable: 0 | 1;
  display_order: number;
};

type ServiceWriteInput = {
  name: string;
  description: string;
  durationMin: number;
  priceCents: number;
  active: boolean;
  visible: boolean;
  bookable: boolean;
  displayOrder?: number;
};

const mapRow = (row: ServiceRow): Service => ({
  id: row.id,
  name: row.name,
  description: row.description,
  durationMin: row.duration_min,
  priceCents: row.price_cents,
  currency: row.currency,
  active: row.active === 1,
  visible: row.visible === 1,
  bookable: row.bookable === 1,
  displayOrder: row.display_order,
});

const listServices = async (
  options: ListServicesOptions = {},
): Promise<Service[]> => {
  const clauses: string[] = [];

  if (!options.includeHidden) {
    clauses.push('visible = 1');
  }

  if (!options.includeInactive) {
    clauses.push('active = 1');
  }

  const whereClause =
    clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = await queryAll<ServiceRow>(
    `
      SELECT
        id,
        name,
        description,
        duration_min,
        price_cents,
        currency,
        active,
        visible,
        bookable,
        display_order
      FROM services
      ${whereClause}
      ORDER BY display_order ASC, name ASC
      `,
  );

  return rows.map(mapRow);
};

const getServiceById = async (serviceId: string): Promise<Service | null> => {
  const row = await queryOne<ServiceRow>(
    `
      SELECT
        id,
        name,
        description,
        duration_min,
        price_cents,
        currency,
        active,
        visible,
        bookable,
        display_order
      FROM services
      WHERE id = ?
      LIMIT 1
      `,
    [serviceId],
  );

  if (!row) {
    return null;
  }

  return mapRow(row);
};

const createService = async (input: ServiceWriteInput): Promise<Service> => {
  const id = `svc_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

  await run(
    `
    INSERT INTO services (
      id, name, description, duration_min, price_cents, currency, active, visible, bookable, display_order
    ) VALUES (?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?)
    `,
    [
      id,
      input.name.trim(),
      input.description.trim(),
      input.durationMin,
      input.priceCents,
      input.active ? 1 : 0,
      input.visible ? 1 : 0,
      input.bookable ? 1 : 0,
      input.displayOrder ?? 100,
    ],
  );

  return getServiceById(id) as Promise<Service>;
};

const updateService = async (
  serviceId: string,
  patch: Partial<ServiceWriteInput>,
): Promise<Service | null> => {
  const existing = await getServiceById(serviceId);
  if (!existing) {
    return null;
  }

  const next: ServiceWriteInput = {
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    durationMin: patch.durationMin ?? existing.durationMin,
    priceCents: patch.priceCents ?? existing.priceCents,
    active: patch.active ?? existing.active,
    visible: patch.visible ?? existing.visible,
    bookable: patch.bookable ?? existing.bookable,
    displayOrder: patch.displayOrder ?? existing.displayOrder,
  };

  await run(
    `
    UPDATE services
    SET
      name = ?,
      description = ?,
      duration_min = ?,
      price_cents = ?,
      active = ?,
      visible = ?,
      bookable = ?,
      display_order = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [
      next.name.trim(),
      next.description.trim(),
      next.durationMin,
      next.priceCents,
      next.active ? 1 : 0,
      next.visible ? 1 : 0,
      next.bookable ? 1 : 0,
      next.displayOrder ?? 100,
      serviceId,
    ],
  );

  return getServiceById(serviceId);
};

const isServiceBookable = async (serviceId: string): Promise<boolean> => {
  const service = await getServiceById(serviceId);

  return Boolean(
    service && service.visible && service.active && service.bookable,
  );
};

export {
  createService,
  getServiceById,
  isServiceBookable,
  listServices,
  updateService,
};
export type { ListServicesOptions, ServiceWriteInput };
