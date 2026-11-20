# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Notifee ProGuard rules
-keep class com.invertase.notifee.** { *; }
-dontwarn com.invertase.notifee.**

# Facebook SDK ProGuard rules
-keep class com.facebook.** { *; }
-keepclassmembers class * extends com.facebook.FacebookActivity { *; }
-dontwarn com.facebook.**
-keepattributes Signature
-keepattributes *Annotation*

# react-native-iap and Nitro Modules ProGuard rules
-keep class com.dooboolab.rniap.** { *; }
-dontwarn com.dooboolab.rniap.**

-keep class com.margelo.nitro.** { *; }
-dontwarn com.margelo.nitro.**

-keep class dev.hyo.openiap.** { *; }
-dontwarn dev.hyo.openiap.**

-keep class com.android.billingclient.** { *; }
-dontwarn com.android.billingclient.**


