#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CIRCUITS_DIR = path.join(__dirname, '..', 'src', 'circuits');
const BUILD_DIR = path.join(CIRCUITS_DIR, 'build');
const SCRIPTS_DIR = path.join(__dirname);

// Validation checks
const CHECKS = [
    {
        name: 'Directory Structure',
        check: validateDirectoryStructure
    },
    {
        name: 'Circuit Files',
        check: validateCircuitFiles
    },
    {
        name: 'Build Scripts',
        check: validateBuildScripts
    },
    {
        name: 'Package Configuration',
        check: validatePackageConfig
    },
    {
        name: 'Docker Configuration',
        check: validateDockerConfig
    },
    {
        name: 'Dependencies',
        check: validateDependencies
    }
];

function validateDirectoryStructure() {
    const requiredDirs = [
        CIRCUITS_DIR,
        BUILD_DIR,
        SCRIPTS_DIR,
        path.join(__dirname, '..', 'src', 'proof')
    ];
    
    const results = [];
    
    for (const dir of requiredDirs) {
        if (fs.existsSync(dir)) {
            results.push(`✓ ${path.relative(process.cwd(), dir)}`);
        } else {
            results.push(`❌ Missing: ${path.relative(process.cwd(), dir)}`);
        }
    }
    
    return results;
}

function validateCircuitFiles() {
    const requiredFiles = [
        'generic_proof.circom',
        'dynamic_comparator.circom', 
        'template_validator.circom',
        'README.md'
    ];
    
    const results = [];
    
    for (const file of requiredFiles) {
        const filePath = path.join(CIRCUITS_DIR, file);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            results.push(`✓ ${file} (${(stats.size / 1024).toFixed(1)}KB)`);
        } else {
            results.push(`❌ Missing: ${file}`);
        }
    }
    
    return results;
}

function validateBuildScripts() {
    const requiredScripts = [
        'compile-circuits.js',
        'setup-circuits.js',
        'test-circuits.js'
    ];
    
    const results = [];
    
    for (const script of requiredScripts) {
        const scriptPath = path.join(SCRIPTS_DIR, script);
        if (fs.existsSync(scriptPath)) {
            try {
                const stats = fs.statSync(scriptPath);
                const isExecutable = stats.mode & parseInt('111', 8);
                results.push(`✓ ${script} ${isExecutable ? '(executable)' : '(not executable)'}`);
            } catch (error) {
                results.push(`⚠️ ${script} (access error)`);
            }
        } else {
            results.push(`❌ Missing: ${script}`);
        }
    }
    
    return results;
}

function validatePackageConfig() {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const results = [];
    
    if (!fs.existsSync(packagePath)) {
        return ['❌ package.json not found'];
    }
    
    try {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        
        // Check scripts
        const requiredScripts = [
            'build:circuits',
            'circuits:compile', 
            'circuits:setup',
            'circuits:test',
            'circuits:clean'
        ];
        
        for (const script of requiredScripts) {
            if (pkg.scripts && pkg.scripts[script]) {
                results.push(`✓ Script: ${script}`);
            } else {
                results.push(`❌ Missing script: ${script}`);
            }
        }
        
        // Check dependencies
        const requiredDeps = ['circomlib', 'snarkjs', 'circom_runtime'];
        const requiredDevDeps = ['circom'];
        
        for (const dep of requiredDeps) {
            if (pkg.dependencies && pkg.dependencies[dep]) {
                results.push(`✓ Dependency: ${dep}@${pkg.dependencies[dep]}`);
            } else {
                results.push(`❌ Missing dependency: ${dep}`);
            }
        }
        
        for (const dep of requiredDevDeps) {
            if (pkg.devDependencies && pkg.devDependencies[dep]) {
                results.push(`✓ Dev dependency: ${dep}@${pkg.devDependencies[dep]}`);
            } else {
                results.push(`❌ Missing dev dependency: ${dep}`);
            }
        }
        
    } catch (error) {
        results.push(`❌ Invalid package.json: ${error.message}`);
    }
    
    return results;
}

function validateDockerConfig() {
    const dockerComposePath = path.join(__dirname, '..', 'docker', 'docker-compose.yml');
    const dockerfilePath = path.join(__dirname, '..', 'Dockerfile');
    const results = [];
    
    // Check docker-compose.yml
    if (fs.existsSync(dockerComposePath)) {
        const content = fs.readFileSync(dockerComposePath, 'utf8');
        
        if (content.includes('circuits:/app/circuits')) {
            results.push('✓ Docker Compose: circuits volume configured');
        } else {
            results.push('❌ Docker Compose: circuits volume missing');
        }
        
        if (content.includes('circuit-build-cache')) {
            results.push('✓ Docker Compose: build cache configured');
        } else {
            results.push('⚠️ Docker Compose: build cache not configured');
        }
    } else {
        results.push('❌ docker-compose.yml not found');
    }
    
    // Check Dockerfile
    if (fs.existsSync(dockerfilePath)) {
        const content = fs.readFileSync(dockerfilePath, 'utf8');
        
        if (content.includes('circuits ./circuits')) {
            results.push('✓ Dockerfile: circuits directory copied');
        } else {
            results.push('❌ Dockerfile: circuits directory not copied');
        }
        
        if (content.includes('build:circuits')) {
            results.push('✓ Dockerfile: circuit build enabled');
        } else {
            results.push('❌ Dockerfile: circuit build missing');
        }
        
        if (content.includes('curl')) {
            results.push('✓ Dockerfile: curl installed for setup');
        } else {
            results.push('⚠️ Dockerfile: curl not installed');
        }
    } else {
        results.push('❌ Dockerfile not found');
    }
    
    return results;
}

function validateDependencies() {
    const results = [];
    
    // Check if circom is available
    try {
        const version = execSync('circom --version', { stdio: 'pipe' }).toString().trim();
        results.push(`✓ Circom: ${version}`);
    } catch (error) {
        results.push('⚠️ Circom: not available in PATH (will use local installation)');
    }
    
    // Check if snarkjs is available
    try {
        const version = execSync('snarkjs --version', { stdio: 'pipe' }).toString().trim();
        results.push(`✓ SnarkJS: ${version}`);
    } catch (error) {
        results.push('⚠️ SnarkJS: not available in PATH (will use local installation)');
    }
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
    
    if (majorVersion >= 18) {
        results.push(`✓ Node.js: ${nodeVersion}`);
    } else {
        results.push(`❌ Node.js: ${nodeVersion} (requires >= 18.0.0)`);
    }
    
    // Check if node_modules exists
    const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
        results.push('✓ Node modules installed');
    } else {
        results.push('❌ Node modules not installed (run npm install)');
    }
    
    return results;
}

// Main validation function
async function runValidation() {
    console.log('🔍 ZEPHIS Circuit Setup Validation\n');
    
    let totalChecks = 0;
    let passedChecks = 0;
    let warnings = 0;
    
    for (const check of CHECKS) {
        console.log(`\n📋 ${check.name}:`);
        
        try {
            const results = check.check();
            
            for (const result of results) {
                console.log(`  ${result}`);
                totalChecks++;
                
                if (result.startsWith('✓')) {
                    passedChecks++;
                } else if (result.startsWith('⚠️')) {
                    warnings++;
                }
            }
            
        } catch (error) {
            console.log(`  ❌ Check failed: ${error.message}`);
            totalChecks++;
        }
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Validation Summary:');
    console.log(`  • Total checks: ${totalChecks}`);
    console.log(`  • Passed: ${passedChecks}`);
    console.log(`  • Warnings: ${warnings}`);
    console.log(`  • Failed: ${totalChecks - passedChecks - warnings}`);
    
    const successRate = (passedChecks / totalChecks * 100).toFixed(1);
    console.log(`  • Success rate: ${successRate}%`);
    
    if (passedChecks === totalChecks) {
        console.log('\n🎉 All checks passed! Setup is complete.');
    } else if (passedChecks + warnings >= totalChecks * 0.8) {
        console.log('\n✅ Setup is mostly complete. Review warnings above.');
    } else {
        console.log('\n⚠️ Setup has issues. Please address failed checks.');
    }
    
    // Next steps
    console.log('\n📝 Next Steps:');
    console.log('  1. Run: npm install (if dependencies are missing)');
    console.log('  2. Run: npm run circuits:compile (to compile circuits)');
    console.log('  3. Run: npm run circuits:setup (to generate keys)');
    console.log('  4. Run: npm run circuits:test (to validate setup)');
    console.log('  5. Run: npm run build (to build the full application)');
    
    return {
        totalChecks,
        passedChecks,
        warnings,
        successRate: parseFloat(successRate)
    };
}

// CLI execution
if (require.main === module) {
    runValidation().then((summary) => {
        process.exit(summary.successRate >= 80 ? 0 : 1);
    }).catch((error) => {
        console.error('\n❌ Validation failed:', error.message);
        process.exit(1);
    });
}

module.exports = { runValidation, CHECKS };