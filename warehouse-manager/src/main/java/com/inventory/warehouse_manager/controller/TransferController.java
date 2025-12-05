package com.inventory.warehouse_manager.controller;

import com.inventory.warehouse_manager.model.dto.TransferRequest;
import com.inventory.warehouse_manager.service.TransferService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/transfers")
public class TransferController {

    private final TransferService transferService;

    public TransferController(TransferService transferService) {
        this.transferService = transferService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.OK)
    public String transfer(@Valid @RequestBody TransferRequest request) {
        transferService.transfer(request);
        return "Transfer completed successfully.";
    }
}
