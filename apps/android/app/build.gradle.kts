import org.apache.tools.ant.taskdefs.condition.Os

plugins {
    id("com.android.application")
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
}

// CC-safe task class
abstract class BuildRustJniTask : Exec() {
    @get:Internal
    abstract val ndkDir: DirectoryProperty
    
    @get:Internal
    abstract val envNdkHome: Property<String>

    init {
        val cargoCommand = if (Os.isFamily(Os.FAMILY_WINDOWS)) "cargo.exe" else "cargo"
        description = "Builds the Rust JNI library for supported architectures."
        executable(cargoCommand)
        args("ndk", "-t", "arm64-v8a", "-t", "armeabi-v7a", "-t", "x86_64", "-o", "../jniLibs", "build", "--release")
    }

    override fun exec() {
        val path = ndkDir.orNull?.asFile?.absolutePath ?: envNdkHome.orNull
        if (path != null) {
            environment("NDK_HOME", path)
        } else {
            throw GradleException("NDK not found. Install NDK 30.0.14904198 or set NDK_HOME.")
        }
        super.exec()
    }
}

android {
    namespace = "com.aetheros"
    compileSdk = 36
    ndkVersion = "30.0.14904198"

    defaultConfig {
        applicationId = "com.aetheros"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    buildFeatures {
        compose = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

val buildRustJni = tasks.register<BuildRustJniTask>("buildRustJni") {
    val rustDir = layout.projectDirectory.dir("src/main/rust")
    workingDir(rustDir)
    inputs.dir(rustDir)
    outputs.dir(layout.projectDirectory.dir("src/main/jniLibs"))
    
    ndkDir.set(androidComponents.sdkComponents.ndkDirectory)
    envNdkHome.set(providers.environmentVariable("NDK_HOME"))
}

tasks.matching { it.name.startsWith("javaPreCompile") }.configureEach {
    dependsOn(buildRustJni)
}

tasks.matching { it.name.contains("merge", ignoreCase = true) && it.name.contains("JniLibFolders", ignoreCase = true) }.configureEach {
    dependsOn(buildRustJni)
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.com.google.android.material)
    implementation(libs.androidx.constraintlayout)
    
    // Networking
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.gson)
    implementation(libs.okhttp.logging.interceptor)

    // Security (for JWT storage)
    implementation(libs.androidx.security.crypto)
    
    // Background Tasks
    implementation(libs.androidx.work.runtime.ktx)
    
    // Compose
    val composeBom = platform(libs.androidx.compose.bom)
    implementation(composeBom)
    androidTestImplementation(composeBom)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material.icons.extended)
    debugImplementation(libs.androidx.compose.ui.tooling)
    
    // Dagger Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)
    implementation(libs.androidx.hilt.work)
    ksp(libs.androidx.hilt.compiler)
    
    // Media3 (ExoPlayer)
    implementation(libs.androidx.media3.exoplayer)
    implementation(libs.androidx.media3.ui)

    // Navigation 3
    implementation(libs.androidx.navigation3.runtime)
    implementation(libs.androidx.navigation3.ui)
    implementation(libs.androidx.lifecycle.viewmodel.navigation3)
}

