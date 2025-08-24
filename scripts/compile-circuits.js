#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CIRCUITS_DIR = path.join(__dirname, '..', 'src', 'circuits');
const BUILD_DIR = path.join(CIRCUITS_DIR, 'build');
const NODE_MODULES_DIR = path.join(__dirname, '..', 'node_modules');

// Ensure circom is available
function checkCircomInstalled() {
    try {
        execSync('circom --version', { stdio: 'pipe' });
        console.log('✓ Circom found in PATH');
        return 'circom';
    } catch (error) {
        // Try local installation
        const localCircom = path.join(NODE_MODULES_DIR, '.bin', 'circom');
        if (fs.existsSync(localCircom)) {
            console.log('✓ Using local Circom installation');
            return localCircom;
        }
        throw new Error('Circom not found. Please install circom globally or locally.');
    }
}

// Create build directory
function createBuildDir() {
    if (!fs.existsSync(BUILD_DIR)) {
        fs.mkdirSync(BUILD_DIR, { recursive: true });
        console.log('✓ Created build directory');
    }
}

// Circuit compilation configuration
const CIRCUITS = [
    {
        name: 'generic_proof',
        file: 'generic_proof.circom',
        template: 'GenericDataProof',
        params: [64, 1024] // max_data_length, max_tls_length
    },
    {
        name: 'balance_proof',
        file: 'generic_proof.circom',
        template: 'BalanceProof',
        params: []
    },
    {
        name: 'follower_proof', 
        file: 'generic_proof.circom',
        template: 'FollowerProof',
        params: []
    },
    {
        name: 'dynamic_comparator',
        file: 'dynamic_comparator.circom', 
        template: 'DynamicComparator',
        params: [64]
    },
    {
        name: 'template_validator',
        file: 'template_validator.circom',
        template: 'TemplateValidator', 
        params: []
    }
];

// Compile a single circuit
function compileCircuit(circuit, circomPath) {
    console.log(`\n📦 Compiling ${circuit.name}...`);
    
    const inputFile = path.join(CIRCUITS_DIR, circuit.file);
    const outputDir = path.join(BUILD_DIR, circuit.name);
    
    if (!fs.existsSync(inputFile)) {
        throw new Error(`Circuit file not found: ${inputFile}`);
    }
    
    // Create output directory
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    try {
        // Compile to R1CS, WASM, and symbols
        const cmd = [
            circomPath,
            '--r1cs',
            '--wasm', 
            '--sym',
            '--c',
            '--json',
            '--output', outputDir,
            '--include', path.join(NODE_MODULES_DIR, 'circomlib', 'circuits'),
            '--include', CIRCUITS_DIR,
            inputFile
        ].join(' ');
        
        console.log(`Running: ${cmd}`);
        execSync(cmd, { 
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: CIRCUITS_DIR 
        });
        
        // Move WASM files to main circuits directory for easier access
        const wasmSrc = path.join(outputDir, circuit.name + '_js', circuit.name + '.wasm');
        const wasmDst = path.join(CIRCUITS_DIR, circuit.name + '.wasm');
        
        if (fs.existsSync(wasmSrc)) {
            fs.copyFileSync(wasmSrc, wasmDst);
            console.log(`✓ WASM file copied to ${wasmDst}`);
        }
        
        // Get circuit info
        const r1csFile = path.join(outputDir, circuit.name + '.r1cs');
        if (fs.existsSync(r1csFile)) {
            const stats = fs.statSync(r1csFile);
            console.log(`✓ R1CS size: ${(stats.size / 1024).toFixed(2)} KB`);
        }
        
        console.log(`✓ Successfully compiled ${circuit.name}`);
        
    } catch (error) {
        console.error(`❌ Failed to compile ${circuit.name}:`);
        console.error(error.stdout?.toString() || error.message);
        throw error;
    }
}

// Generate constraint info
function generateConstraintInfo() {
    console.log('\n📊 Generating constraint information...');
    
    const infoFile = path.join(BUILD_DIR, 'circuit-info.json');
    const circuitInfo = {};
    
    for (const circuit of CIRCUITS) {
        const r1csFile = path.join(BUILD_DIR, circuit.name, circuit.name + '.r1cs');
        const wasmFile = path.join(CIRCUITS_DIR, circuit.name + '.wasm');
        
        const info = {
            name: circuit.name,
            template: circuit.template,
            params: circuit.params,
            files: {}
        };
        
        if (fs.existsSync(r1csFile)) {
            const stats = fs.statSync(r1csFile);
            info.files.r1cs = {
                path: r1csFile,
                size: stats.size
            };
        }
        
        if (fs.existsSync(wasmFile)) {
            const stats = fs.statSync(wasmFile);
            info.files.wasm = {
                path: wasmFile,
                size: stats.size
            };
        }
        
        circuitInfo[circuit.name] = info;
    }
    
    fs.writeFileSync(infoFile, JSON.stringify(circuitInfo, null, 2));
    console.log(`✓ Circuit info saved to ${infoFile}`);
}

// Create circuit manifest
function createCircuitManifest() {
    console.log('\n📄 Creating circuit manifest...');
    
    const manifest = {
        version: "1.0.0",
        buildTime: new Date().toISOString(),
        circuits: CIRCUITS.map(c => ({
            name: c.name,
            template: c.template,
            params: c.params,
            wasmPath: `circuits/${c.name}.wasm`,
            r1csPath: `circuits/build/${c.name}/${c.name}.r1cs`
        })),
        dependencies: {
            circom: "^2.1.8",
            circomlib: "^2.0.5",
            snarkjs: "^0.7.5"
        }
    };
    
    const manifestFile = path.join(CIRCUITS_DIR, 'manifest.json');
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
    console.log(`✓ Manifest saved to ${manifestFile}`);
}

// Main compilation process
async function main() {
    try {
        console.log('🚀 Starting circuit compilation...\n');
        
        const circomPath = checkCircomInstalled();
        createBuildDir();
        
        // Compile all circuits
        for (const circuit of CIRCUITS) {
            compileCircuit(circuit, circomPath);
        }
        
        generateConstraintInfo();
        createCircuitManifest();
        
        console.log('\n🎉 Circuit compilation completed successfully!');
        console.log(`\nCompiled circuits:`);
        CIRCUITS.forEach(c => {
            console.log(`  • ${c.name} (${c.template})`);
        });
        
    } catch (error) {
        console.error('\n❌ Circuit compilation failed:');
        console.error(error.message);
        process.exit(1);
    }
}

// Handle CLI execution
if (require.main === module) {
    main();
}

module.exports = { compileCircuit, CIRCUITS, BUILD_DIR, CIRCUITS_DIR };