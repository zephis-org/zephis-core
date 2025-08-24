pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/gates.circom";

template GenericProof(maxDataLength, maxClaimLength) {
    // Public inputs
    signal input dataHash;          // Hash of the extracted data
    signal input claimHash;         // Hash of the claim being proven
    signal input templateHash;      // Hash of the template configuration
    signal input threshold;         // Numeric threshold for comparisons
    signal input timestamp;         // Timestamp of the proof
    
    // Private inputs
    signal private input data[maxDataLength];        // Raw data fields
    signal private input claim[maxClaimLength];      // Claim parameters
    signal private input dataType;                   // Type of data being proven (0: numeric, 1: string, 2: boolean)
    signal private input claimType;                  // Type of claim (0: comparison, 1: existence, 2: pattern)
    signal private input actualValue;                // The actual value being compared/checked
    
    // Outputs
    signal output isValid;          // Whether the proof is valid
    signal output provenClaim;      // The claim that was proven
    
    // Components for hashing and comparison
    component dataHasher = Poseidon(maxDataLength);
    component claimHasher = Poseidon(maxClaimLength);
    component thresholdComparator = GreaterThan(64);
    component equalityCheck = IsEqual();
    component andGate = AND();
    
    // Hash the input data to verify integrity
    for (var i = 0; i < maxDataLength; i++) {
        dataHasher.inputs[i] <== data[i];
    }
    
    // Verify data hash matches public input
    component dataHashCheck = IsEqual();
    dataHashCheck.in[0] <== dataHasher.out;
    dataHashCheck.in[1] <== dataHash;
    
    // Hash the claim parameters
    for (var i = 0; i < maxClaimLength; i++) {
        claimHasher.inputs[i] <== claim[i];
    }
    
    // Verify claim hash matches public input
    component claimHashCheck = IsEqual();
    claimHashCheck.in[0] <== claimHasher.out;
    claimHashCheck.in[1] <== claimHash;
    
    // Claim verification logic based on claim type
    component claimResult;
    
    // For numeric comparisons (claimType == 0)
    component isNumericClaim = IsEqual();
    isNumericClaim.in[0] <== claimType;
    isNumericClaim.in[1] <== 0;
    
    thresholdComparator.in[0] <== actualValue;
    thresholdComparator.in[1] <== threshold;
    
    // For existence checks (claimType == 1)
    component isExistenceClaim = IsEqual();
    isExistenceClaim.in[0] <== claimType;
    isExistenceClaim.in[1] <== 1;
    
    component existenceCheck = GreaterThan(32);
    existenceCheck.in[0] <== actualValue;
    existenceCheck.in[1] <== 0;
    
    // For boolean checks (claimType == 2)
    component isBooleanClaim = IsEqual();
    isBooleanClaim.in[0] <== claimType;
    isBooleanClaim.in[1] <== 2;
    
    component booleanCheck = IsEqual();
    booleanCheck.in[0] <== actualValue;
    booleanCheck.in[1] <== 1; // true
    
    // Combine claim results based on claim type
    component numericResult = AND();
    numericResult.a <== isNumericClaim.out;
    numericResult.b <== thresholdComparator.out;
    
    component existenceResult = AND();
    existenceResult.a <== isExistenceClaim.out;
    existenceResult.b <== existenceCheck.out;
    
    component booleanResult = AND();
    booleanResult.a <== isBooleanClaim.out;
    booleanResult.b <== booleanCheck.out;
    
    // Final claim verification (any of the three types can be true)
    component finalOr1 = OR();
    finalOr1.a <== numericResult.out;
    finalOr1.b <== existenceResult.out;
    
    component finalOr2 = OR();
    finalOr2.a <== finalOr1.out;
    finalOr2.b <== booleanResult.out;
    
    // Final validity check: all hash checks must pass AND claim must be valid
    component hashChecksAnd = AND();
    hashChecksAnd.a <== dataHashCheck.out;
    hashChecksAnd.b <== claimHashCheck.out;
    
    andGate.a <== hashChecksAnd.out;
    andGate.b <== finalOr2.out;
    
    // Assign outputs
    isValid <== andGate.out;
    provenClaim <== claimHash;
    
    // Constraint to ensure timestamp is within reasonable bounds (not too far in future/past)
    component timestampCheck = LessEqThan(64);
    timestampCheck.in[0] <== timestamp;
    timestampCheck.in[1] <== 2000000000; // Unix timestamp limit for year ~2033
    
    // Add timestamp constraint to final validity
    component finalValidityAnd = AND();
    finalValidityAnd.a <== isValid;
    finalValidityAnd.b <== timestampCheck.out;
    
    // Ensure the proven claim output matches the input claim hash
    equalityCheck.in[0] <== provenClaim;
    equalityCheck.in[1] <== claimHash;
    
    // Final output must satisfy all constraints
    component outputConstraint = AND();
    outputConstraint.a <== finalValidityAnd.out;
    outputConstraint.b <== equalityCheck.out;
    
    // Force the circuit to only output 1 if all constraints are satisfied
    isValid <== outputConstraint.out;
}

// Default instantiation with reasonable limits
component main = GenericProof(32, 16);