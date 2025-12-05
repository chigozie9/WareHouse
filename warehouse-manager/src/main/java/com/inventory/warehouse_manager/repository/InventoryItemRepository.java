package com.inventory.warehouse_manager.repository;

import com.inventory.warehouse_manager.model.entity.InventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {

    List<InventoryItem> findByWarehouseId(Long warehouseId);


// Finds a specific inventory item by warehouse + SKU (Stock Keeping Unit).
// SKU = unique product code used in inventory/warehouse systems.
    Optional<InventoryItem> findByWarehouseIdAndSku(Long warehouseId, String sku);
}
