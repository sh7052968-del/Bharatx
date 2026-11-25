package com.example.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.ui.i18n.LocalConnectXStrings
import com.example.viewmodel.ConnectXViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HubScreen(
    viewModel: ConnectXViewModel,
    onOpenChat: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val strings = LocalConnectXStrings.current
    val contactsState by viewModel.contacts.collectAsStateWithLifecycle()
    val directoryState by viewModel.directoryMembers.collectAsStateWithLifecycle()
    val callsState by viewModel.calls.collectAsStateWithLifecycle()
    val workspaceStatuses by viewModel.workspaceStatuses.collectAsStateWithLifecycle()
    val myStatuses by viewModel.myStatuses.collectAsStateWithLifecycle()

    var selectedTab by rememberSaveable { mutableIntStateOf(0) }
    var showAddContact by remember { mutableStateOf(false) }
    var showStartCall by remember { mutableStateOf(false) }
    var showCreateStatus by remember { mutableStateOf(false) }

    val tabs = listOf(strings.contactsTab, strings.callsTab, strings.statusTab, strings.channelsTab)

    if (selectedTab == 3) {
        Column(modifier = modifier.fillMaxSize()) {
            TopAppBar(
                title = { Text(strings.navHub, style = MaterialTheme.typography.titleLarge) },
            )
            SingleChoiceSegmentedButtonRow(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            ) {
                tabs.forEachIndexed { idx, label ->
                    SegmentedButton(
                        selected = selectedTab == idx,
                        onClick = { selectedTab = idx },
                        shape = SegmentedButtonDefaults.itemShape(idx, tabs.size),
                        modifier = Modifier.testTag("hub_tab_$idx"),
                    ) { Text(label, maxLines = 1) }
                }
            }
            Spacer(Modifier.height(6.dp))
            ChannelsScreen(viewModel = viewModel, showTopBar = false, modifier = Modifier.weight(1f))
        }
        return
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(strings.navHub, style = MaterialTheme.typography.titleLarge)
                        Text(
                            "${strings.contactsTab} • ${strings.callsTab} • ${strings.statusTab} • ${strings.channelsTab}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
            )
        },
        floatingActionButton = {
            when (selectedTab) {
                0 -> FloatingActionButton(onClick = { showAddContact = true }, modifier = Modifier.testTag("add_contact_fab")) {
                    Icon(Icons.Filled.PersonAdd, contentDescription = "Add Contact")
                }
                1 -> FloatingActionButton(onClick = { showStartCall = true }, modifier = Modifier.testTag("start_call_fab")) {
                    Icon(Icons.Filled.Call, contentDescription = "Start Call")
                }
                2 -> FloatingActionButton(onClick = { showCreateStatus = true }, modifier = Modifier.testTag("create_status_fab")) {
                    Icon(Icons.Filled.Add, contentDescription = "Post Status")
                }
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
        ) {
            SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                tabs.forEachIndexed { idx, label ->
                    SegmentedButton(
                        selected = selectedTab == idx,
                        onClick = { selectedTab = idx },
                        shape = SegmentedButtonDefaults.itemShape(idx, tabs.size),
                        modifier = Modifier.testTag("hub_tab_$idx"),
                    ) { Text(label, maxLines = 1) }
                }
            }
            Spacer(Modifier.height(10.dp))

            when (selectedTab) {
                0 -> ContactsTabContent(
                    viewModel = viewModel,
                    contactsState = contactsState,
                    directoryState = directoryState,
                    onOpenChat = onOpenChat,
                    showAddDialog = showAddContact,
                    onDismissAddDialog = { showAddContact = false },
                    onOpenAddDialog = { showAddContact = true },
                )
                1 -> CallsTabContent(
                    viewModel = viewModel,
                    callsState = callsState,
                    contactsState = contactsState,
                    directoryState = directoryState,
                    showStartCallDialog = showStartCall,
                    onDismissStartCall = { showStartCall = false },
                    onOpenStartCall = { showStartCall = true },
                )
                2 -> StatusTabContent(
                    viewModel = viewModel,
                    workspaceState = workspaceStatuses,
                    myState = myStatuses,
                    showCreateDialog = showCreateStatus,
                    onDismissCreate = { showCreateStatus = false },
                    onOpenCreate = { showCreateStatus = true },
                )
            }
        }
    }
}
