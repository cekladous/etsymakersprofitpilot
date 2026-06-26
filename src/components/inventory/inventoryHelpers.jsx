/**
 * Inventory Management Helpers
 * Handles automatic inventory tracking for MaterialPurchase and BusinessExpense
 */

import { base44 } from "@/api/base44Client";

/**
 * Process a material purchase and update inventory
 * Creates or updates inventory item with average cost calculation
 */
export async function processInventoryPurchase(materialPurchase) {
  const { material_name, quantity, unit_cost, total_cost, purchase_date, id, owner_user_id } = materialPurchase;

  if (!material_name || !quantity || quantity <= 0) {
    return null;
  }

  // Find existing inventory item (scoped to this user)
  const existingItems = await base44.entities.InventoryItem.filter(
    { material_name, owner_user_id },
    "-last_updated",
    1
  );

  let inventoryItem;
  const cost = unit_cost || (total_cost / quantity);

  if (existingItems.length > 0) {
    // Update existing item with weighted average cost
    inventoryItem = existingItems[0];
    const oldQty = inventoryItem.quantity_on_hand || 0;
    const oldAvgCost = inventoryItem.average_cost || 0;
    const newQty = oldQty + quantity;
    const newAvgCost = ((oldQty * oldAvgCost) + (quantity * cost)) / newQty;
    const newTotalValue = newQty * newAvgCost;

    await base44.entities.InventoryItem.update(inventoryItem.id, {
      quantity_on_hand: newQty,
      average_cost: newAvgCost,
      total_value: newTotalValue,
      last_updated: new Date().toISOString(),
    });

    inventoryItem = {
      ...inventoryItem,
      quantity_on_hand: newQty,
      average_cost: newAvgCost,
      total_value: newTotalValue,
    };
  } else {
    // Create new inventory item
    inventoryItem = await base44.entities.InventoryItem.create({
      owner_user_id,
      material_name,
      quantity_on_hand: quantity,
      average_cost: cost,
      total_value: total_cost,
      last_updated: new Date().toISOString(),
    });
  }

  // Create transaction record
  await base44.entities.InventoryTransaction.create({
    owner_user_id,
    inventory_item_id: inventoryItem.id,
    transaction_date: purchase_date,
    transaction_type: "purchase",
    quantity_change: quantity,
    unit_cost: cost,
    reference_id: id,
    notes: `Purchase from ${materialPurchase.vendor || "supplier"}`,
  });

  return inventoryItem;
}

/**
 * Process a business expense that uses inventory
 * Deducts quantity from inventory using average cost
 */
export async function processInventoryUsage(businessExpense) {
  const { description, amount, date, id, owner_user_id } = businessExpense;

  // Try to find matching inventory item by description (scoped to this user)
  const materialName = description || "Unknown Material";
  
  const existingItems = await base44.entities.InventoryItem.filter(
    { material_name: materialName, owner_user_id },
    "-last_updated",
    1
  );

  if (existingItems.length === 0) {
    console.warn(`No inventory item found for: ${materialName}`);
    return null;
  }

  const inventoryItem = existingItems[0];
  const avgCost = inventoryItem.average_cost || 0;
  
  // Calculate quantity used based on expense amount and average cost
  const quantityUsed = avgCost > 0 ? amount / avgCost : 0;

  if (quantityUsed === 0) {
    console.warn(`Cannot calculate quantity for zero average cost`);
    return null;
  }

  const newQty = Math.max(0, (inventoryItem.quantity_on_hand || 0) - quantityUsed);
  const newTotalValue = newQty * avgCost;

  // Update inventory item
  await base44.entities.InventoryItem.update(inventoryItem.id, {
    quantity_on_hand: newQty,
    total_value: newTotalValue,
    last_updated: new Date().toISOString(),
  });

  // Create transaction record
  await base44.entities.InventoryTransaction.create({
    owner_user_id,
    inventory_item_id: inventoryItem.id,
    transaction_date: date,
    transaction_type: "usage",
    quantity_change: -quantityUsed,
    unit_cost: avgCost,
    reference_id: id,
    notes: `Usage: ${description}`,
  });

  return {
    ...inventoryItem,
    quantity_on_hand: newQty,
    total_value: newTotalValue,
  };
}