# Capacitor
-keep class com.getcapacitor.** { *; }
-keep class com.capacitor.** { *; }
-keep class org.apache.cordova.** { *; }

# WebView
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep app classes
-keep class com.pitd.chess.test1.** { *; }
