pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/gates.circom";
include "circomlib/circuits/mimcsponge.circom";

/*
 * TemplateValidator - Validates template authenticity and domain binding
 * 
 * This circuit ensures that:
 * 1. The template hash matches the expected template
 * 2. The domain is authorized for the template
 * 3. The template hasn't been tampered with
 * 4. Template is within validity period
 */
template TemplateValidator() {
    // Public inputs
    signal input template_hash;                 // Hash of the template being used
    signal input domain_hash;                   // Hash of the domain
    signal input timestamp;                     // Current timestamp
    
    // Private inputs - template details
    signal private input template_id;           // Unique template identifier
    signal private input template_version;      // Template version number
    signal private input authorized_domains[16]; // Array of authorized domain hashes
    signal private input domain_count;          // Number of authorized domains
    signal private input valid_from;            // Template validity start time
    signal private input valid_until;           // Template validity end time
    signal private input template_data[64];     // Template configuration data
    signal private input template_data_length;  // Length of template data
    
    // Output
    signal output valid;                        // 1 if template is valid, 0 otherwise
    signal output computed_hash;                // Computed template hash for verification
    
    // Template hash computation
    component template_hasher = TemplateHasher(64);
    template_hasher.template_id <== template_id;
    template_hasher.template_version <== template_version;
    template_hasher.valid_from <== valid_from;
    template_hasher.valid_until <== valid_until;
    template_hasher.data_length <== template_data_length;
    template_hasher.domain_count <== domain_count;
    
    for (var i = 0; i < 64; i++) {
        template_hasher.template_data[i] <== template_data[i];
    }
    for (var i = 0; i < 16; i++) {
        template_hasher.authorized_domains[i] <== authorized_domains[i];
    }
    
    computed_hash <== template_hasher.hash;
    
    // Verify template hash matches
    component hash_check = IsEqual();
    hash_check.in[0] <== template_hash;
    hash_check.in[1] <== computed_hash;
    
    // Verify domain is authorized
    component domain_validator = DomainValidator(16);
    domain_validator.domain_hash <== domain_hash;
    domain_validator.domain_count <== domain_count;
    for (var i = 0; i < 16; i++) {
        domain_validator.authorized_domains[i] <== authorized_domains[i];
    }
    
    // Verify timestamp is within validity period
    component time_validator = TimeValidator();
    time_validator.timestamp <== timestamp;
    time_validator.valid_from <== valid_from;
    time_validator.valid_until <== valid_until;
    
    // All validations must pass
    component hash_and_domain = AND();
    hash_and_domain.a <== hash_check.out;
    hash_and_domain.b <== domain_validator.valid;
    
    component final_validation = AND();
    final_validation.a <== hash_and_domain.out;
    final_validation.b <== time_validator.valid;
    
    valid <== final_validation.out;
}

/*
 * TemplateHasher - Computes template hash from components
 */
template TemplateHasher(max_data_length) {
    signal input template_id;
    signal input template_version;
    signal input valid_from;
    signal input valid_until;
    signal input template_data[max_data_length];
    signal input data_length;
    signal input authorized_domains[16];
    signal input domain_count;
    
    signal output hash;
    
    // Create input array for Poseidon hash
    // Format: [template_id, version, valid_from, valid_until, data_length, domain_count, ...data, ...domains]
    signal hash_inputs[max_data_length + 22];
    
    hash_inputs[0] <== template_id;
    hash_inputs[1] <== template_version;
    hash_inputs[2] <== valid_from;
    hash_inputs[3] <== valid_until;
    hash_inputs[4] <== data_length;
    hash_inputs[5] <== domain_count;
    
    // Add template data
    for (var i = 0; i < max_data_length; i++) {
        hash_inputs[6 + i] <== template_data[i];
    }
    
    // Add authorized domains
    for (var i = 0; i < 16; i++) {
        hash_inputs[6 + max_data_length + i] <== authorized_domains[i];
    }
    
    // Use MiMC for large input hashing
    component hasher = MiMCSponge(max_data_length + 22, 220, 1);
    hasher.k <== 0; // Use default key
    
    for (var i = 0; i < max_data_length + 22; i++) {
        hasher.ins[i] <== hash_inputs[i];
    }
    
    hash <== hasher.outs[0];
}

/*
 * DomainValidator - Checks if domain is in authorized list
 */
template DomainValidator(max_domains) {
    signal input domain_hash;
    signal input authorized_domains[max_domains];
    signal input domain_count;
    signal output valid;
    
    // Check if domain_hash matches any authorized domain
    signal matches[max_domains];
    signal cumulative_or[max_domains + 1];
    cumulative_or[0] <== 0;
    
    for (var i = 0; i < max_domains; i++) {
        component eq_check = IsEqual();
        eq_check.in[0] <== domain_hash;
        eq_check.in[1] <== authorized_domains[i];
        
        // Only consider domains within domain_count
        component within_count = LessEqThan(8);
        within_count.in[0] <== i + 1;
        within_count.in[1] <== domain_count;
        
        component domain_match = AND();
        domain_match.a <== eq_check.out;
        domain_match.b <== within_count.out;
        
        matches[i] <== domain_match.out;
        
        // Accumulate OR result
        component or_gate = OR();
        or_gate.a <== cumulative_or[i];
        or_gate.b <== matches[i];
        cumulative_or[i + 1] <== or_gate.out;
    }
    
    valid <== cumulative_or[max_domains];
}

/*
 * TimeValidator - Validates timestamp is within validity period
 */
template TimeValidator() {
    signal input timestamp;
    signal input valid_from;
    signal input valid_until;
    signal output valid;
    
    component after_start = GreaterEqThan(64);
    after_start.in[0] <== timestamp;
    after_start.in[1] <== valid_from;
    
    component before_end = LessEqThan(64);
    before_end.in[0] <== timestamp;
    before_end.in[1] <== valid_until;
    
    component time_valid = AND();
    time_valid.a <== after_start.out;
    time_valid.b <== before_end.out;
    
    valid <== time_valid.out;
}

/*
 * TemplateRegistry - Manages multiple template validations
 */
template TemplateRegistry(max_templates) {
    signal input template_hash;
    signal input domain_hash;
    signal input timestamp;
    signal input template_count;
    
    // Array of registered templates
    signal private input templates[max_templates][70]; // Each template has 70 fields
    
    signal output valid;
    signal output matched_template_id;
    
    // Check each template
    signal template_matches[max_templates];
    signal template_ids[max_templates];
    
    for (var i = 0; i < max_templates; i++) {
        component validator = TemplateValidator();
        validator.template_hash <== template_hash;
        validator.domain_hash <== domain_hash;
        validator.timestamp <== timestamp;
        
        // Extract template data from flat array
        validator.template_id <== templates[i][0];
        validator.template_version <== templates[i][1];
        validator.valid_from <== templates[i][2];
        validator.valid_until <== templates[i][3];
        validator.template_data_length <== templates[i][4];
        validator.domain_count <== templates[i][5];
        
        for (var j = 0; j < 64; j++) {
            validator.template_data[j] <== templates[i][6 + j];
        }
        
        // Only check templates within count
        component within_count = LessEqThan(8);
        within_count.in[0] <== i + 1;
        within_count.in[1] <== template_count;
        
        component template_valid = AND();
        template_valid.a <== validator.valid;
        template_valid.b <== within_count.out;
        
        template_matches[i] <== template_valid.out;
        template_ids[i] <== templates[i][0] * template_matches[i]; // Template ID if matched
    }
    
    // Check if any template matched
    signal cumulative_valid[max_templates + 1];
    signal cumulative_id[max_templates + 1];
    cumulative_valid[0] <== 0;
    cumulative_id[0] <== 0;
    
    for (var i = 0; i < max_templates; i++) {
        component or_valid = OR();
        or_valid.a <== cumulative_valid[i];
        or_valid.b <== template_matches[i];
        cumulative_valid[i + 1] <== or_valid.out;
        
        cumulative_id[i + 1] <== cumulative_id[i] + template_ids[i];
    }
    
    valid <== cumulative_valid[max_templates];
    matched_template_id <== cumulative_id[max_templates];
}

/*
 * Specialized validators for common template types
 */

// Social media template validator
template SocialMediaTemplateValidator() {
    component validator = TemplateValidator();
    
    // Connect all signals
    validator.template_hash <== template_hash;
    validator.domain_hash <== domain_hash;
    validator.timestamp <== timestamp;
    validator.template_id <== template_id;
    validator.template_version <== template_version;
    validator.authorized_domains[0] <== authorized_domains[0];
    validator.domain_count <== 1; // Single domain for social media
    validator.valid_from <== valid_from;
    validator.valid_until <== valid_until;
    validator.template_data_length <== template_data_length;
    
    for (var i = 0; i < 64; i++) {
        validator.template_data[i] <== template_data[i];
    }
    for (var i = 1; i < 16; i++) {
        validator.authorized_domains[i] <== 0;
    }
    
    // Expose interface
    signal input template_hash;
    signal input domain_hash;
    signal input timestamp;
    signal private input template_id;
    signal private input template_version;
    signal private input authorized_domains[1];
    signal private input valid_from;
    signal private input valid_until;
    signal private input template_data[64];
    signal private input template_data_length;
    
    signal output valid;
    signal output computed_hash;
    
    valid <== validator.valid;
    computed_hash <== validator.computed_hash;
}

// Financial template validator  
template FinancialTemplateValidator() {
    component validator = TemplateValidator();
    
    // Similar setup for financial templates with stricter validation
    validator.template_hash <== template_hash;
    validator.domain_hash <== domain_hash;
    validator.timestamp <== timestamp;
    validator.template_id <== template_id;
    validator.template_version <== template_version;
    validator.domain_count <== domain_count;
    validator.valid_from <== valid_from;
    validator.valid_until <== valid_until;
    validator.template_data_length <== template_data_length;
    
    for (var i = 0; i < 64; i++) {
        validator.template_data[i] <== template_data[i];
    }
    for (var i = 0; i < 16; i++) {
        validator.authorized_domains[i] <== authorized_domains[i];
    }
    
    // Additional financial-specific validations could be added here
    
    // Expose interface  
    signal input template_hash;
    signal input domain_hash;
    signal input timestamp;
    signal private input template_id;
    signal private input template_version;
    signal private input authorized_domains[16];
    signal private input domain_count;
    signal private input valid_from;
    signal private input valid_until;
    signal private input template_data[64];
    signal private input template_data_length;
    
    signal output valid;
    signal output computed_hash;
    
    valid <== validator.valid;
    computed_hash <== validator.computed_hash;
}