#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

const CIRCUITS_DIR = path.join(__dirname, '..', 'src', 'circuits');
const BUILD_DIR = path.join(CIRCUITS_DIR, 'build');
const SETUP_DIR = path.join(CIRCUITS_DIR, 'setup');
const NODE_MODULES_DIR = path.join(__dirname, '..', 'node_modules');

// Powers of Tau ceremony parameters
const PTAU_CONFIG = {
    power: 15, // 2^15 = 32768 constraints
    filename: 'powersOfTau28_hez_final_15.ptau',
    url: 'https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau'
};

// Check if snarkjs is available
function checkSnarkjsInstalled() {
    try {
        execSync('snarkjs --version', { stdio: 'pipe' });
        console.log('✓ SnarkJS found in PATH');
        return 'snarkjs';
    } catch (error) {
        const localSnarkjs = path.join(NODE_MODULES_DIR, '.bin', 'snarkjs');
        if (fs.existsSync(localSnarkjs)) {
            console.log('✓ Using local SnarkJS installation');
            return localSnarkjs;
        }
        throw new Error('SnarkJS not found. Please install snarkjs globally or locally.');
    }
}

// Create setup directory
function createSetupDir() {
    if (!fs.existsSync(SETUP_DIR)) {
        fs.mkdirSync(SETUP_DIR, { recursive: true });
        console.log('✓ Created setup directory');
    }
}

// Download Powers of Tau file if not exists
async function downloadPowersOfTau() {
    const ptauPath = path.join(SETUP_DIR, PTAU_CONFIG.filename);
    
    if (fs.existsSync(ptauPath)) {
        console.log('✓ Powers of Tau file already exists');
        return ptauPath;
    }
    
    console.log(`📥 Downloading Powers of Tau file (this may take a while)...`);
    console.log(`URL: ${PTAU_CONFIG.url}`);
    
    try {
        // Use curl to download (more reliable than node's http)
        execSync(`curl -L "${PTAU_CONFIG.url}" -o "${ptauPath}"`, {
            stdio: 'inherit',
            timeout: 300000 // 5 minutes timeout
        });
        
        if (fs.existsSync(ptauPath)) {
            const stats = fs.statSync(ptauPath);
            console.log(`✓ Downloaded Powers of Tau: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
            return ptauPath;
        } else {
            throw new Error('Download failed - file not found');
        }
    } catch (error) {
        console.error('❌ Failed to download Powers of Tau file');
        console.error('Please download manually from:');
        console.error(PTAU_CONFIG.url);
        console.error(`Save to: ${ptauPath}`);
        throw error;
    }
}

// Generate random entropy for ceremony
function generateRandomEntropy() {
    return crypto.randomBytes(32).toString('hex');
}

// Perform trusted setup for a circuit
async function setupCircuit(circuitName, snarkjsPath, ptauPath) {
    console.log(`\n🔐 Setting up circuit: ${circuitName}`);
    
    const circuitBuildDir = path.join(BUILD_DIR, circuitName);
    const r1csPath = path.join(circuitBuildDir, `${circuitName}.r1cs`);
    const zkey0Path = path.join(circuitBuildDir, `${circuitName}_0000.zkey`);
    const zkeyFinalPath = path.join(CIRCUITS_DIR, `${circuitName}_final.zkey`);
    const vkeyPath = path.join(CIRCUITS_DIR, `verification_key.json`);
    
    if (!fs.existsSync(r1csPath)) {
        throw new Error(`R1CS file not found: ${r1csPath}`);
    }
    
    try {
        // Phase 1: Powers of Tau setup (already done with downloaded file)
        
        // Phase 2: Circuit-specific setup
        console.log(`  📋 Phase 2: Circuit-specific setup...`);
        
        // Step 1: Create initial zkey
        const step1Cmd = `${snarkjsPath} zkey new "${r1csPath}" "${ptauPath}" "${zkey0Path}"`;
        console.log(`  Running: ${path.basename(step1Cmd)}`);
        execSync(step1Cmd, { stdio: 'pipe' });
        
        // Step 2: Contribute to ceremony (simulation of real ceremony)
        const entropy = generateRandomEntropy();
        const zkey1Path = path.join(circuitBuildDir, `${circuitName}_0001.zkey`);
        
        const step2Cmd = `${snarkjsPath} zkey contribute "${zkey0Path}" "${zkey1Path}" --name="First contribution" --entropy="${entropy}"`;
        console.log(`  🎲 Contributing randomness...`);
        execSync(step2Cmd, { stdio: 'pipe' });
        
        // Step 3: Second contribution (for better security)
        const entropy2 = generateRandomEntropy();
        const zkey2Path = path.join(circuitBuildDir, `${circuitName}_0002.zkey`);
        
        const step3Cmd = `${snarkjsPath} zkey contribute "${zkey1Path}" "${zkey2Path}" --name="Second contribution" --entropy="${entropy2}"`;
        console.log(`  🎲 Adding second contribution...`);
        execSync(step3Cmd, { stdio: 'pipe' });
        
        // Step 4: Apply random beacon (final step)
        const beaconHash = crypto.createHash('sha256').update('zephis-protocol-beacon-' + Date.now()).digest('hex');
        
        const step4Cmd = `${snarkjsPath} zkey beacon "${zkey2Path}" "${zkeyFinalPath}" "${beaconHash}" 10 --name="Final beacon"`;
        console.log(`  🚨 Applying random beacon...`);
        execSync(step4Cmd, { stdio: 'pipe' });
        
        // Step 5: Generate verification key
        const step5Cmd = `${snarkjsPath} zkey export verificationkey "${zkeyFinalPath}" "${vkeyPath}"`;
        console.log(`  🔑 Exporting verification key...`);
        execSync(step5Cmd, { stdio: 'pipe' });
        
        // Clean up intermediate files
        [zkey0Path, zkey1Path, zkey2Path].forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
        
        // Get file sizes
        const zkeyStats = fs.statSync(zkeyFinalPath);
        const vkeyStats = fs.statSync(vkeyPath);
        
        console.log(`  ✓ Setup complete for ${circuitName}`);
        console.log(`    - Final zkey: ${(zkeyStats.size / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`    - Verification key: ${(vkeyStats.size / 1024).toFixed(2)} KB`);
        
        return {
            circuitName,
            zkeyPath: zkeyFinalPath,
            vkeyPath,
            zkeySize: zkeyStats.size,
            vkeySize: vkeyStats.size
        };
        
    } catch (error) {
        console.error(`❌ Setup failed for ${circuitName}:`);
        console.error(error.message);
        throw error;
    }
}

// Verify setup integrity
async function verifySetup(circuitName, snarkjsPath) {
    console.log(`\n🔍 Verifying setup for ${circuitName}...`);
    
    const zkeyPath = path.join(CIRCUITS_DIR, `${circuitName}_final.zkey`);
    const r1csPath = path.join(BUILD_DIR, circuitName, `${circuitName}.r1cs`);
    
    try {
        const verifyCmd = `${snarkjsPath} zkey verify "${r1csPath}" "${SETUP_DIR}/${PTAU_CONFIG.filename}" "${zkeyPath}"`;
        execSync(verifyCmd, { stdio: 'pipe' });
        console.log(`✓ Setup verification passed for ${circuitName}`);
        return true;
    } catch (error) {
        console.error(`❌ Setup verification failed for ${circuitName}`);
        return false;
    }
}

// Generate ceremony info
function generateCeremonyInfo(results) {
    console.log('\n📄 Generating ceremony information...');
    
    const ceremonyInfo = {
        timestamp: new Date().toISOString(),
        ptauFile: PTAU_CONFIG.filename,
        ptauPower: PTAU_CONFIG.power,
        circuits: results.map(r => ({
            name: r.circuitName,
            zkeyPath: path.relative(CIRCUITS_DIR, r.zkeyPath),
            vkeyPath: path.relative(CIRCUITS_DIR, r.vkeyPath),
            zkeySize: r.zkeySize,
            vkeySize: r.vkeySize
        })),
        security: {
            contributions: 2,
            beaconApplied: true,
            entropySource: 'crypto.randomBytes'
        },
        notes: [
            'This is a development setup suitable for testing',
            'For production, use a proper trusted setup ceremony',
            'Keys generated with random beacon for additional security'
        ]
    };
    
    const ceremonyFile = path.join(CIRCUITS_DIR, 'ceremony-info.json');
    fs.writeFileSync(ceremonyFile, JSON.stringify(ceremonyInfo, null, 2));
    console.log(`✓ Ceremony info saved to ${ceremonyFile}`);
}

// Get circuits from compilation manifest
function getCircuitsToSetup() {
    const manifestPath = path.join(CIRCUITS_DIR, 'manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
        console.log('⚠️  No manifest found, using default circuit list');
        return ['generic_proof', 'balance_proof', 'follower_proof'];
    }
    
    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        return manifest.circuits.map(c => c.name);
    } catch (error) {
        console.log('⚠️  Failed to read manifest, using default circuit list');
        return ['generic_proof', 'balance_proof', 'follower_proof'];
    }
}

// Main setup process
async function main() {
    try {
        console.log('🚀 Starting trusted setup ceremony...\n');
        
        const snarkjsPath = checkSnarkjsInstalled();
        createSetupDir();
        
        const ptauPath = await downloadPowersOfTau();
        const circuits = getCircuitsToSetup();
        
        console.log(`\n🎯 Setting up ${circuits.length} circuits:`);
        circuits.forEach(c => console.log(`  • ${c}`));
        
        const results = [];
        
        // Setup each circuit
        for (const circuitName of circuits) {
            try {
                const result = await setupCircuit(circuitName, snarkjsPath, ptauPath);
                results.push(result);
                
                // Verify setup
                await verifySetup(circuitName, snarkjsPath);
                
            } catch (error) {
                console.error(`❌ Failed to setup ${circuitName}, continuing with others...`);
            }
        }
        
        if (results.length === 0) {
            throw new Error('No circuits were successfully set up');
        }
        
        generateCeremonyInfo(results);
        
        console.log('\n🎉 Trusted setup completed successfully!');
        console.log(`\nSetup results:`);
        results.forEach(r => {
            console.log(`  • ${r.circuitName}: zkey ${(r.zkeySize / (1024 * 1024)).toFixed(1)}MB, vkey ${(r.vkeySize / 1024).toFixed(1)}KB`);
        });
        
        console.log(`\n⚠️  Development Setup Notice:`);
        console.log(`   This setup is suitable for testing and development.`);
        console.log(`   For production deployment, use a proper multi-party ceremony.`);
        
    } catch (error) {
        console.error('\n❌ Trusted setup failed:');
        console.error(error.message);
        process.exit(1);
    }
}

// Handle CLI execution
if (require.main === module) {
    main();
}

module.exports = { 
    setupCircuit, 
    verifySetup, 
    downloadPowersOfTau,
    PTAU_CONFIG,
    SETUP_DIR,
    CIRCUITS_DIR
};