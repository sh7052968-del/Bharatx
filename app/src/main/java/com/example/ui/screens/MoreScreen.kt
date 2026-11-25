package com.example.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.example.model.ConversationType
import com.example.ui.i18n.LocalConnectXStrings
import com.example.viewmodel.ConnectXViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoreScreen(
    viewModel: ConnectXViewModel,
    onOpenSupportChat: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val strings = LocalConnectXStrings.current
    var selectedTab by rememberSaveable { mutableIntStateOf(0) }
    val tabs = listOf(strings.settingsTab, strings.supportTab, strings.governanceTab)

    Column(modifier = modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                Text(
                    text = tabs[selectedTab],
                    style = MaterialTheme.typography.titleLarge,
                )
            },
            actions = {
                if (selectedTab == 1) {
                    androidx.compose.material3.TextButton(
                        onClick = {
                            viewModel.createConversation(
                                title = "ConnectX Support Desk",
                                type = ConversationType.SUPPORT,
                                participantUids = emptyList(),
                                initialMessage = "Hello Support Team, I need assistance with my workspace.",
                                labels = listOf("support"),
                            ) { onOpenSupportChat() }
                        },
                    ) { Text("Live Desk") }
                }
            },
        )
        SingleChoiceSegmentedButtonRow(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        ) {
            tabs.forEachIndexed { idx, label ->
                SegmentedButton(
                    selected = selectedTab == idx,
                    onClick = { selectedTab = idx },
                    shape = SegmentedButtonDefaults.itemShape(idx, tabs.size),
                    modifier = Modifier.testTag("more_tab_$idx"),
                ) { Text(label) }
            }
        }
        Spacer(Modifier.height(6.dp))
        when (selectedTab) {
            0 -> ProfileScreen(viewModel = viewModel, showTopBar = false, modifier = Modifier.weight(1f))
            1 -> SupportScreen(viewModel = viewModel, onOpenSupportChat = onOpenSupportChat, showTopBar = false, modifier = Modifier.weight(1f))
            2 -> GovernanceScreen(viewModel = viewModel, showTopBar = false, modifier = Modifier.weight(1f))
        }
    }
}
