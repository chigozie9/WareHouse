package com.inventory.warehouse_manager.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.inventory.warehouse_manager.model.entity.Warehouse;

public interface WarehouseRepository extends JpaRepository<Warehouse, Long> {
}