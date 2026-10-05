package com.inventory.warehouse_manager.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.inventory.warehouse_manager.model.entity.Warehouse;

public interface WarehouseRepository extends JpaRepository<Warehouse, Long> {

    // BUG-2 fix: used to reject duplicate names before hitting the DB constraint
    boolean existsByName(String name);

    // Same check for updates, ignoring the warehouse being updated
    boolean existsByNameAndIdNot(String name, Long id);
}
