; boot.asm — Multiboot v1 entry point for ButtonOS
;
; GRUB (and QEMU's built-in `-kernel` loader) hands control to us in 32-bit
; protected mode with paging disabled, per the Multiboot spec. Our job here is
; tiny: give the CPU a stack, then jump into the C kernel. Everything else
; happens in kmain().

MBALIGN  equ 1 << 0            ; align loaded modules on page boundaries
MEMINFO  equ 1 << 1            ; ask the bootloader for a memory map
FLAGS    equ MBALIGN | MEMINFO
MAGIC    equ 0x1BADB002        ; the magic number that marks a Multiboot header
CHECKSUM equ -(MAGIC + FLAGS)  ; magic + flags + checksum must sum to zero

; The Multiboot header. GRUB scans the first 8 KiB of the kernel for this.
section .multiboot
align 4
    dd MAGIC
    dd FLAGS
    dd CHECKSUM

; A small stack. x86 needs esp pointing at valid memory before we can call C.
section .bss
align 16
stack_bottom:
    resb 16384                 ; 16 KiB
stack_top:

section .text
global _start
_start:
    mov esp, stack_top         ; the stack grows downward from the top

    push ebx                   ; ebx = pointer to the Multiboot info struct
    push eax                   ; eax = the Multiboot magic (0x2BADB002)
    extern kmain
    call kmain                 ; hand off to the C kernel

    ; kmain should never return, but if it does, halt the CPU forever.
    cli
.hang:
    hlt
    jmp .hang

; Mark the stack as non-executable to keep the modern linker quiet.
section .note.GNU-stack noalloc noexec nowrite progbits
