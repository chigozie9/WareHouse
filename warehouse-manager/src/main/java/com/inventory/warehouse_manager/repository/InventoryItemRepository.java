package com.inventory.warehouse_manager.repository;

import com.inventory.warehouse_manager.model.entity.InventoryItem;
import com.inventory.warehouse_manager.model.entity.Warehouse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {

    // All items that belong to a given Warehouse
    List<InventoryItem> findAllByWarehouse(Warehouse warehouse);

    // One item in a specific warehouse by SKU
    Optional<InventoryItem> findByWarehouseAndSku(Warehouse warehouse, String sku);
}
