pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/gates.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/mux1.circom";

/*
 * DynamicComparator - Flexible comparison circuit for different claim types
 * 
 * Supports multiple comparison operations:
 * - 1: Greater Than (GT)
 * - 2: Less Than (LT) 
 * - 3: Equal To (EQ)
 * - 4: Contains (substring/pattern matching)
 * - 5: Range Check (between min and max)
 * - 6: Not Equal (NEQ)
 */
template DynamicComparator(max_data_length) {
    signal input claim_type;                    // Type of comparison to perform
    signal input threshold;                     // Primary threshold value
    signal input threshold_max;                 // Secondary threshold for range checks
    signal input data[max_data_length];         // Input data array
    signal input data_length;                   // Actual length of data
    signal input pattern[32];                   // Pattern for contains checks
    signal input pattern_length;                // Length of pattern
    
    signal output result;                       // 1 if comparison passes, 0 otherwise
    
    // Extract numeric value from data array (little-endian)
    signal numeric_value;
    component value_extractor = NumericExtractor(max_data_length);
    value_extractor.data_length <== data_length;
    for (var i = 0; i < max_data_length; i++) {
        value_extractor.data[i] <== data[i];
    }
    numeric_value <== value_extractor.value;
    
    // Comparison components
    component gt_check = GreaterThan(64);
    component lt_check = LessThan(64);  
    component eq_check = IsEqual();
    component neq_check = IsEqual();
    component range_check_min = GreaterEqThan(64);
    component range_check_max = LessEqThan(64);
    
    // Pattern matching component
    component contains_check = ContainsPattern(max_data_length, 32);
    
    // Setup comparisons
    gt_check.in[0] <== numeric_value;
    gt_check.in[1] <== threshold;
    
    lt_check.in[0] <== numeric_value;
    lt_check.in[1] <== threshold;
    
    eq_check.in[0] <== numeric_value;
    eq_check.in[1] <== threshold;
    
    neq_check.in[0] <== numeric_value;
    neq_check.in[1] <== threshold;
    
    range_check_min.in[0] <== numeric_value;
    range_check_min.in[1] <== threshold;
    range_check_max.in[0] <== numeric_value;
    range_check_max.in[1] <== threshold_max;
    
    // Setup contains check
    contains_check.data_length <== data_length;
    contains_check.pattern_length <== pattern_length;
    for (var i = 0; i < max_data_length; i++) {
        contains_check.data[i] <== data[i];
    }
    for (var i = 0; i < 32; i++) {
        contains_check.pattern[i] <== pattern[i];
    }
    
    // Range check result (both conditions must be true)
    component range_and = AND();
    range_and.a <== range_check_min.out;
    range_and.b <== range_check_max.out;
    
    // NOT operation for NEQ
    component not_gate = NOT();
    not_gate.in <== neq_check.out;
    
    // Multiplexer to select result based on claim_type
    component result_mux = Mux1();
    result_mux.c[0][0] <== 0;                    // Invalid claim type
    result_mux.c[1][0] <== gt_check.out;        // GT
    result_mux.c[1][1] <== lt_check.out;        // LT  
    result_mux.c[2][0] <== eq_check.out;        // EQ
    result_mux.c[2][1] <== contains_check.result; // Contains
    result_mux.c[3][0] <== range_and.out;       // Range
    result_mux.c[3][1] <== not_gate.out;        // NEQ
    
    // Select appropriate result based on claim_type
    // Need to handle claim_type encoding properly
    component claim_type_bits = Num2Bits(3);
    claim_type_bits.in <== claim_type;
    
    result_mux.s[0] <== claim_type_bits.out[0];
    result_mux.s[1] <== claim_type_bits.out[1]; 
    result_mux.s[2] <== claim_type_bits.out[2];
    
    result <== result_mux.out;
}

/*
 * NumericExtractor - Converts byte array to numeric value
 */
template NumericExtractor(max_length) {
    signal input data[max_length];
    signal input data_length;
    signal output value;
    
    // Convert byte array to number (little-endian)
    signal partial_sums[max_length + 1];
    partial_sums[0] <== 0;
    
    signal powers[max_length];
    powers[0] <== 1;
    
    for (var i = 1; i < max_length; i++) {
        powers[i] <== powers[i-1] * 256;
    }
    
    for (var i = 0; i < max_length; i++) {
        // Only include bytes within data_length
        component is_valid = LessEqThan(8);
        is_valid.in[0] <== i + 1;
        is_valid.in[1] <== data_length;
        
        partial_sums[i + 1] <== partial_sums[i] + data[i] * powers[i] * is_valid.out;
    }
    
    value <== partial_sums[max_length];
}

/*
 * ContainsPattern - Pattern matching within data array
 */  
template ContainsPattern(data_length, pattern_length) {
    signal input data[data_length];
    signal input pattern[pattern_length];
    signal input data_length_actual;
    signal input pattern_length_actual;
    signal output result;
    
    // Track if pattern is found at any position
    signal found[data_length];
    found[0] <== 0;
    
    for (var i = 0; i < data_length - 1; i++) {
        component pattern_match = PatternMatchAtPosition(pattern_length);
        
        // Setup pattern matching at position i
        pattern_match.start_pos <== i;
        pattern_match.data_length <== data_length_actual;
        pattern_match.pattern_length <== pattern_length_actual;
        
        for (var j = 0; j < data_length && j < data_length; j++) {
            pattern_match.data[j] <== data[j];
        }
        
        for (var j = 0; j < pattern_length; j++) {
            pattern_match.pattern[j] <== pattern[j];
        }
        
        // Accumulate found results
        component or_gate = OR();
        or_gate.a <== found[i];
        or_gate.b <== pattern_match.matches;
        found[i + 1] <== or_gate.out;
    }
    
    result <== found[data_length - 1];
}

/*
 * PatternMatchAtPosition - Check if pattern matches at specific position
 */
template PatternMatchAtPosition(max_pattern_length) {
    signal input data[100];                     // Fixed size for simplicity
    signal input pattern[max_pattern_length];
    signal input start_pos;
    signal input data_length;
    signal input pattern_length;
    signal output matches;
    
    // Check each character in pattern
    signal char_matches[max_pattern_length];
    signal cumulative_match[max_pattern_length + 1];
    cumulative_match[0] <== 1;
    
    for (var i = 0; i < max_pattern_length; i++) {
        component pos_check = LessEqThan(8);
        pos_check.in[0] <== i + 1;
        pos_check.in[1] <== pattern_length;
        
        component bound_check = LessEqThan(8);
        bound_check.in[0] <== start_pos + i + 1;
        bound_check.in[1] <== data_length;
        
        component char_eq = IsEqual();
        char_eq.in[0] <== data[start_pos + i];
        char_eq.in[1] <== pattern[i];
        
        // Character matches if: within pattern bounds AND within data bounds AND characters equal
        component valid_and_eq = AND();
        valid_and_eq.a <== pos_check.out;
        valid_and_eq.b <== bound_check.out;
        
        component final_match = AND();
        final_match.a <== valid_and_eq.out;
        final_match.b <== char_eq.out;
        
        char_matches[i] <== final_match.out;
        
        // Accumulate match result
        component next_match = AND();
        next_match.a <== cumulative_match[i];
        next_match.b <== char_matches[i];
        cumulative_match[i + 1] <== next_match.out;
    }
    
    matches <== cumulative_match[max_pattern_length];
}

/*
 * Utility templates for common comparisons
 */

template GreaterThanComparator() {
    signal input value;
    signal input threshold;
    signal output result;
    
    component gt = GreaterThan(64);
    gt.in[0] <== value;
    gt.in[1] <== threshold;
    result <== gt.out;
}

template RangeComparator() {
    signal input value;
    signal input min_val;
    signal input max_val;
    signal output result;
    
    component min_check = GreaterEqThan(64);
    component max_check = LessEqThan(64);
    
    min_check.in[0] <== value;
    min_check.in[1] <== min_val;
    
    max_check.in[0] <== value;
    max_check.in[1] <== max_val;
    
    component and_gate = AND();
    and_gate.a <== min_check.out;
    and_gate.b <== max_check.out;
    
    result <== and_gate.out;
}