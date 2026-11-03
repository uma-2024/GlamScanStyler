package com.glammefypartner

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.reactnative.androidsdk.FBSDKPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          try {
            // Guarantee Facebook SDK bridge is registered in React Native host
            if (none { it is FBSDKPackage }) {
              add(FBSDKPackage())
            }
          } catch (e: Exception) {
            android.util.Log.e("MainApplication", "FBSDKPackage failed to load", e)
          }
        },
    )
  }

  // FCM may display a notification before the React Native runtime starts.
  private fun createPushChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java)
    val audio = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_NOTIFICATION)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    val bookings = NotificationChannel(
      "booking-requests-v3", "Incoming Booking Requests", NotificationManager.IMPORTANCE_HIGH
    ).apply {
      setSound(Uri.parse("android.resource://$packageName/raw/ring_3"), audio)
      enableVibration(true)
      vibrationPattern = longArrayOf(300, 1000, 300, 1000, 300, 1000)
    }
    val general = NotificationChannel(
      "glammefy-notifications-v3", "GlamMefy Notifications", NotificationManager.IMPORTANCE_HIGH
    )
    manager.createNotificationChannels(listOf(bookings, general))
  }

  override fun onCreate() {
    super.onCreate()
    createPushChannels()
    loadReactNative(this)
  }
}
