/* linker.ld — memory layout for the ButtonOS kernel.
 *
 * The kernel is loaded at the 1 MiB mark, which is the conventional home for a
 * Multiboot kernel: it sits above the low memory that the BIOS and real-mode
 * IVT care about. Sections are laid out in the order the bootloader expects,
 * with the .multiboot header first so GRUB can find it early. */

ENTRY(_start)

SECTIONS
{
    . = 1M;

    .text BLOCK(4K) : ALIGN(4K)
    {
        *(.multiboot)
        *(.text)
    }

    .rodata BLOCK(4K) : ALIGN(4K)
    {
        *(.rodata)
    }

    .data BLOCK(4K) : ALIGN(4K)
    {
        *(.data)
    }

    .bss BLOCK(4K) : ALIGN(4K)
    {
        *(COMMON)
        *(.bss)
    }
}
