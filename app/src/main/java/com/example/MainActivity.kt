package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.example.data.ConnectXRepository
import com.example.data.UiState
import com.example.data.authStateFlow
import com.example.model.CallStatus
import com.example.ui.i18n.LocalConnectXStrings
import com.example.ui.i18n.ThemeMode
import com.example.ui.screens.ActiveCallOverlayDialog
import com.example.ui.screens.AuthScreen
import com.example.ui.screens.BusinessScreen
import com.example.ui.screens.ChatsScreen
import com.example.ui.screens.DashboardScreen
import com.example.ui.screens.HubScreen
import com.example.ui.screens.MoreScreen
import com.example.ui.theme.ConnectXTheme
import com.example.viewmodel.ConnectXViewModel
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.auth
import com.google.firebase.firestore.FirebaseFirestore

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AppContent()
        }
    }
}

private data class ConnectXDestination(
    val label: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
    val testTag: String,
)

@Composable
fun AppContent(auth: FirebaseAuth = Firebase.auth) {
    val currentUser by auth.authStateFlow().collectAsStateWithLifecycle(initialValue = auth.currentUser)
    var refreshTick by remember { mutableIntStateOf(0) }

    DisposableEffect(auth) {
        val listener = FirebaseAuth.AuthStateListener { refreshTick++ }
        auth.addAuthStateListener(listener)
        onDispose { auth.removeAuthStateListener(listener) }
    }

    val user = currentUser
    if (user == null) {
        ConnectXTheme {
            AuthScreen(onAuthSuccess = { refreshTick++ })
        }
    } else {
        key(user.uid) {
            ConnectXMainShell(currentUserId = user.uid)
        }
    }
}

@Composable
private fun ConnectXMainShell(currentUserId: String) {
    val viewModel: ConnectXViewModel = viewModel(
        key = currentUserId,
        factory = viewModelFactory {
            initializer {
                val app = checkNotNull(this[APPLICATION_KEY]) {
                    "APPLICATION_KEY missing from CreationExtras"
                }
                val databaseId = app.getString(R.string.firestore_database_id)
                val db = FirebaseFirestore.getInstance(databaseId)
                ConnectXViewModel(ConnectXRepository(db), currentUserId)
            }
        },
    )

    val profileState by viewModel.userProfile.collectAsStateWithLifecycle()
    val callsState by viewModel.calls.collectAsStateWithLifecycle()
    val profile = (profileState as? UiState.Success)?.data

    ConnectXTheme(
        themeMode = profile?.parsedThemeMode ?: ThemeMode.SYSTEM,
        languageCode = profile?.languageCode ?: "en",
    ) {
        val strings = LocalConnectXStrings.current
        val destinations = remember(strings) {
            listOf(
                ConnectXDestination(strings.navHome, Icons.Filled.Home, Icons.Outlined.Home, "nav_home"),
                ConnectXDestination(strings.navChats, Icons.AutoMirrored.Filled.Chat, Icons.AutoMirrored.Outlined.Chat, "nav_chats"),
                ConnectXDestination(strings.navHub, Icons.Filled.Groups, Icons.Outlined.Groups, "nav_hub"),
                ConnectXDestination(strings.navBusiness, Icons.Filled.Storefront, Icons.Outlined.Storefront, "nav_business"),
                ConnectXDestination(strings.navMore, Icons.Filled.Tune, Icons.Outlined.Tune, "nav_more"),
            )
        }

        var selectedIndex by rememberSaveable { mutableIntStateOf(0) }
        val snackbarHostState = remember { SnackbarHostState() }

        LaunchedEffect(viewModel) {
            viewModel.statusMessage.collect { msg ->
                snackbarHostState.showSnackbar(msg)
            }
        }

        BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
            val useRail = maxWidth >= 600.dp

            Scaffold(
                snackbarHost = { SnackbarHost(snackbarHostState) },
                contentWindowInsets = WindowInsets(0, 0, 0, 0),
                bottomBar = {
                    if (!useRail) {
                        NavigationBar {
                            destinations.forEachIndexed { index, dest ->
                                val selected = selectedIndex == index
                                NavigationBarItem(
                                    selected = selected,
                                    onClick = { selectedIndex = index },
                                    icon = {
                                        Icon(
                                            imageVector = if (selected) dest.selectedIcon else dest.unselectedIcon,
                                            contentDescription = dest.label,
                                        )
                                    },
                                    label = { Text(dest.label, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                                    modifier = Modifier.testTag(dest.testTag),
                                )
                            }
                        }
                    }
                },
            ) { innerPadding ->
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding),
                ) {
                    if (useRail) {
                        NavigationRail(modifier = Modifier.fillMaxHeight()) {
                            destinations.forEachIndexed { index, dest ->
                                val selected = selectedIndex == index
                                NavigationRailItem(
                                    selected = selected,
                                    onClick = { selectedIndex = index },
                                    icon = {
                                        Icon(
                                            imageVector = if (selected) dest.selectedIcon else dest.unselectedIcon,
                                            contentDescription = dest.label,
                                        )
                                    },
                                    label = { Text(dest.label, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                                    modifier = Modifier.testTag(dest.testTag),
                                )
                            }
                        }
                    }

                    when (selectedIndex) {
                        0 -> DashboardScreen(
                            viewModel = viewModel,
                            onNavigateToChats = { selectedIndex = 1 },
                            onNavigateToHub = { selectedIndex = 2 },
                            onNavigateToBusiness = { selectedIndex = 3 },
                            onNavigateToMore = { selectedIndex = 4 },
                            modifier = Modifier.weight(1f),
                        )
                        1 -> ChatsScreen(viewModel = viewModel, modifier = Modifier.weight(1f))
                        2 -> HubScreen(
                            viewModel = viewModel,
                            onOpenChat = { selectedIndex = 1 },
                            modifier = Modifier.weight(1f),
                        )
                        3 -> BusinessScreen(viewModel = viewModel, modifier = Modifier.weight(1f))
                        4 -> MoreScreen(
                            viewModel = viewModel,
                            onOpenSupportChat = { selectedIndex = 1 },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }

        val activeCall = ((callsState as? UiState.Success)?.data ?: emptyList()).firstOrNull {
            it.parsedStatus == CallStatus.RINGING || it.parsedStatus == CallStatus.ACTIVE
        }
        activeCall?.let { call ->
            ActiveCallOverlayDialog(
                call = call,
                currentUserId = currentUserId,
                onAccept = { viewModel.updateCallStatus(call.id, CallStatus.ACTIVE, 0L) },
                onDecline = { viewModel.updateCallStatus(call.id, CallStatus.DECLINED, 0L) },
                onEnd = { elapsed -> viewModel.updateCallStatus(call.id, CallStatus.ENDED, elapsed) },
            )
        }
    }
}
