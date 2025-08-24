pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";
include "./dynamic_comparator.circom";
include "./template_validator.circom";

/*
 * GenericDataProof - A flexible ZK circuit for proving data claims without revealing the data itself
 * 
 * This circuit enables proving various claims about extracted data from TLS sessions:
 * - Currency amounts (balance greater than threshold)
 * - Follower counts (minimum followers requirement)
 * - Age verification (account older than threshold)
 * - Contains checks (data contains specific pattern)
 * 
 * The circuit is template-agnostic and supports dynamic input sizing.
 */
template GenericDataProof(max_data_length, max_tls_length) {
    // Private inputs - hidden from verifier
    signal private input extracted_data[max_data_length];     // The actual extracted data
    signal private input tls_session_data[max_tls_length];    // TLS session proof data
    signal private input data_length;                         // Actual length of extracted data
    signal private input tls_length;                          // Actual length of TLS data
    
    // Public inputs - revealed to verifier
    signal input template_hash;                               // Hash of the template used
    signal input claim_type;                                  // Type of claim (1=gt, 2=lt, 3=eq, 4=contains)
    signal input threshold_value;                             // Threshold for comparison
    signal input domain_hash;                                 // Hash of the domain
    signal input timestamp_min;                               // Minimum timestamp for validity
    signal input timestamp_max;                               // Maximum timestamp for validity
    
    // Output
    signal output proof_valid;                                // 1 if proof is valid, 0 otherwise
    signal output data_hash;                                  // Hash of the extracted data (for uniqueness)
    signal output session_hash;                               // Hash of the TLS session
    
    // Components
    component template_validator = TemplateValidator();
    component dynamic_comparator = DynamicComparator(max_data_length);
    component data_hasher = Poseidon(max_data_length);
    component session_hasher = Poseidon(max_tls_length);
    component timestamp_check = LessEqThan(64);
    component timestamp_min_check = GreaterEqThan(64);
    
    // Constraint: data_length must be within bounds
    component data_length_check = LessEqThan(32);
    data_length_check.in[0] <== data_length;
    data_length_check.in[1] <== max_data_length;
    data_length_check.out === 1;
    
    // Constraint: tls_length must be within bounds  
    component tls_length_check = LessEqThan(32);
    tls_length_check.in[0] <== tls_length;
    tls_length_check.in[1] <== max_tls_length;
    tls_length_check.out === 1;
    
    // Validate template hash
    template_validator.template_hash <== template_hash;
    template_validator.domain_hash <== domain_hash;
    
    // Hash the extracted data for uniqueness proof
    for (var i = 0; i < max_data_length; i++) {
        data_hasher.inputs[i] <== extracted_data[i];
    }
    data_hash <== data_hasher.out;
    
    // Hash the TLS session data for integrity
    for (var i = 0; i < max_tls_length; i++) {
        session_hasher.inputs[i] <== tls_session_data[i];
    }
    session_hash <== session_hasher.out;
    
    // Perform dynamic comparison based on claim type
    dynamic_comparator.claim_type <== claim_type;
    dynamic_comparator.threshold <== threshold_value;
    dynamic_comparator.data_length <== data_length;
    
    for (var i = 0; i < max_data_length; i++) {
        dynamic_comparator.data[i] <== extracted_data[i];
    }
    
    // Timestamp validation - ensure data is within valid time window
    // Extract timestamp from first 8 elements of extracted_data (assumed to be timestamp)
    var timestamp = 0;
    var multiplier = 1;
    for (var i = 0; i < 8; i++) {
        timestamp += extracted_data[i] * multiplier;
        multiplier = multiplier * 256;
    }
    
    timestamp_min_check.in[0] <== timestamp;
    timestamp_min_check.in[1] <== timestamp_min;
    
    timestamp_check.in[0] <== timestamp;
    timestamp_check.in[1] <== timestamp_max;
    
    // Final validation: all components must pass
    component final_and = AND();
    final_and.a <== template_validator.valid;
    
    component claim_and_timestamp = AND();
    claim_and_timestamp.a <== dynamic_comparator.result;
    
    component timestamp_validity = AND();
    timestamp_validity.a <== timestamp_min_check.out;
    timestamp_validity.b <== timestamp_check.out;
    
    claim_and_timestamp.b <== timestamp_validity.out;
    final_and.b <== claim_and_timestamp.out;
    
    proof_valid <== final_and.out;
}

/*
 * Specialized templates for common use cases
 */

// For balance/currency checks
template BalanceProof() {
    component generic = GenericDataProof(32, 1024);
    
    // Connect all signals
    for (var i = 0; i < 32; i++) {
        generic.extracted_data[i] <== extracted_data[i];
    }
    for (var i = 0; i < 1024; i++) {
        generic.tls_session_data[i] <== tls_session_data[i];
    }
    
    generic.data_length <== data_length;
    generic.tls_length <== tls_length;
    generic.template_hash <== template_hash;
    generic.claim_type <== 1; // Greater than
    generic.threshold_value <== threshold_value;
    generic.domain_hash <== domain_hash;
    generic.timestamp_min <== timestamp_min;
    generic.timestamp_max <== timestamp_max;
    
    // Expose same interface
    signal private input extracted_data[32];
    signal private input tls_session_data[1024];
    signal private input data_length;
    signal private input tls_length;
    signal input template_hash;
    signal input threshold_value;
    signal input domain_hash;
    signal input timestamp_min;
    signal input timestamp_max;
    
    signal output proof_valid;
    signal output data_hash;
    signal output session_hash;
    
    proof_valid <== generic.proof_valid;
    data_hash <== generic.data_hash;
    session_hash <== generic.session_hash;
}

// For follower count checks  
template FollowerProof() {
    component generic = GenericDataProof(16, 512);
    
    // Connect all signals with appropriate sizes
    for (var i = 0; i < 16; i++) {
        generic.extracted_data[i] <== extracted_data[i];
    }
    for (var i = 0; i < 512; i++) {
        generic.tls_session_data[i] <== tls_session_data[i];
    }
    
    generic.data_length <== data_length;
    generic.tls_length <== tls_length;
    generic.template_hash <== template_hash;
    generic.claim_type <== 1; // Greater than
    generic.threshold_value <== threshold_value;
    generic.domain_hash <== domain_hash;
    generic.timestamp_min <== timestamp_min;
    generic.timestamp_max <== timestamp_max;
    
    // Expose interface
    signal private input extracted_data[16];
    signal private input tls_session_data[512];
    signal private input data_length;
    signal private input tls_length;
    signal input template_hash;
    signal input threshold_value;
    signal input domain_hash;
    signal input timestamp_min;
    signal input timestamp_max;
    
    signal output proof_valid;
    signal output data_hash;
    signal output session_hash;
    
    proof_valid <== generic.proof_valid;
    data_hash <== generic.data_hash;
    session_hash <== generic.session_hash;
}

// Main component for compilation
component main = GenericDataProof(64, 1024);