package expo.modules.applocale

import android.app.LocaleManager
import android.content.Context
import android.os.Build
import android.os.LocaleList
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The Android 13+ per-app language (Settings → Apps → MotoVault → Language),
 * read and written with LocaleManager. Older Android has no such setting, so
 * there `isSupported` is false and the app keeps its own stored choice.
 *
 * Tags are a comma-separated BCP-47 list; an empty string means "follow the
 * system language".
 */
class AppLocaleModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("AppLocale")

    Function("isSupported") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
    }

    Function("getApplicationLocales") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return@Function ""
      context.getSystemService(LocaleManager::class.java).applicationLocales.toLanguageTags()
    }

    Function("setApplicationLocales") { tags: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return@Function
      context.getSystemService(LocaleManager::class.java).applicationLocales =
        LocaleList.forLanguageTags(tags)
    }
  }
}
