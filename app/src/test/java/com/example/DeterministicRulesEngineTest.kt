package com.example

import com.example.model.BusinessOrder
import com.example.model.CatalogItem
import com.example.model.DeterministicRulesEngine
import com.example.model.OrderStatus
import com.example.model.PlanTier
import com.example.model.PriorityLevel
import com.example.model.QuickReply
import com.example.model.SupportTicket
import com.example.model.TicketStatus
import com.example.model.UserRole
import com.example.ui.i18n.stringsForLanguage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DeterministicRulesEngineTest {

    @Test
    fun `classifySupportPriority deterministically routes urgent and high keywords`() {
        assertEquals(
            PriorityLevel.URGENT,
            DeterministicRulesEngine.classifySupportPriority("Production outage", "Gateway down"),
        )
        assertEquals(
            PriorityLevel.HIGH,
            DeterministicRulesEngine.classifySupportPriority("Billing invoice", "Need refund status"),
        )
        assertEquals(
            PriorityLevel.NORMAL,
            DeterministicRulesEngine.classifySupportPriority("General question", "What are your hours?"),
        )
    }

    @Test
    fun `calculateOrderTotalCents enforces exact arithmetic`() {
        assertEquals(7500L, DeterministicRulesEngine.calculateOrderTotalCents(3L, 2500L))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `calculateOrderTotalCents rejects zero quantity`() {
        DeterministicRulesEngine.calculateOrderTotalCents(0L, 2500L)
    }

    @Test
    fun `resolveQuickReplyShortcut expands matching slash command`() {
        val templates = listOf(
            QuickReply(id = "1", shortcut = "/hours", title = "Hours", body = "Mon-Fri 09:00-18:00"),
            QuickReply(id = "2", shortcut = "/pricing", title = "Pricing", body = "Plans start at $25/mo"),
        )
        assertEquals(
            "Mon-Fri 09:00-18:00",
            DeterministicRulesEngine.resolveQuickReplyShortcut(" /HOURS ", templates),
        )
        assertEquals(
            "Hello team",
            DeterministicRulesEngine.resolveQuickReplyShortcut("Hello team", templates),
        )
    }

    @Test
    fun `rbac permission checks strictly separate roles`() {
        assertTrue(DeterministicRulesEngine.canManageRoles(UserRole.ADMIN))
        assertFalse(DeterministicRulesEngine.canManageRoles(UserRole.BUSINESS_MANAGER))
        assertTrue(DeterministicRulesEngine.canManageTickets(UserRole.AGENT))
        assertFalse(DeterministicRulesEngine.canManageTickets(UserRole.MEMBER))
    }

    @Test
    fun `computeBusinessMetrics aggregates non-cancelled revenue and open tickets`() {
        val catalog = listOf(
            CatalogItem(id = "c1", inStock = true),
            CatalogItem(id = "c2", inStock = false),
        )
        val orders = listOf(
            BusinessOrder(id = "o1", status = OrderStatus.FULFILLED.name, totalCents = 5000L),
            BusinessOrder(id = "o2", status = OrderStatus.PENDING.name, totalCents = 3000L),
            BusinessOrder(id = "o3", status = OrderStatus.CANCELLED.name, totalCents = 9900L),
        )
        val tickets = listOf(
            SupportTicket(id = "t1", status = TicketStatus.OPEN.name),
            SupportTicket(id = "t2", status = TicketStatus.RESOLVED.name),
        )
        val metrics = DeterministicRulesEngine.computeBusinessMetrics(catalog, orders, tickets)
        assertEquals(2, metrics.totalCatalogCount)
        assertEquals(1, metrics.inStockCount)
        assertEquals(3, metrics.totalOrdersCount)
        assertEquals(1, metrics.fulfilledOrdersCount)
        assertEquals(8000L, metrics.revenueCents)
        assertEquals(1, metrics.openTicketsCount)
    }

    @Test
    fun `formatDuration formats mm ss cleanly and clamps negatives`() {
        assertEquals("00:00", DeterministicRulesEngine.formatDuration(-5L))
        assertEquals("01:05", DeterministicRulesEngine.formatDuration(65L))
        assertEquals("10:00", DeterministicRulesEngine.formatDuration(600L))
    }

    @Test
    fun `stringsForLanguage switches cleanly between English Hindi and Assamese`() {
        val en = stringsForLanguage("en")
        val hi = stringsForLanguage("hi")
        val asStrings = stringsForLanguage("as")
        val fallback = stringsForLanguage("unknown")

        assertEquals("Home", en.navHome)
        assertEquals("होम", hi.navHome)
        assertEquals("হোম", asStrings.navHome)
        assertEquals(en.navHome, fallback.navHome)
        assertNotEquals(en.dashboardTitle, hi.dashboardTitle)
        assertNotEquals(hi.dashboardTitle, asStrings.dashboardTitle)
    }

    @Test
    fun `PlanTier resolves pricing and defaults to STARTER`() {
        assertEquals(PlanTier.GROWTH, PlanTier.fromRaw("GROWTH"))
        assertEquals(2900L, PlanTier.GROWTH.monthlyPriceCents)
        assertEquals(PlanTier.STARTER, PlanTier.fromRaw("INVALID"))
    }
}
