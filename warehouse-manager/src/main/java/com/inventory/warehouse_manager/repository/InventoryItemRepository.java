package com.inventory.warehouse_manager.repository;

import com.inventory.warehouse_manager.model.entity.InventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {

    // List all items for a warehouse
    List<InventoryItem> findByWarehouseId(Long warehouseId);

    // Find a specific item in a warehouse by SKU
    Optional<InventoryItem> findByWarehouseIdAndSku(Long warehouseId, String sku);

    // Check if a warehouse still has any items (used before deleting warehouse)
    boolean existsByWarehouseId(Long warehouseId);
}
