library(gamlss)
library(emmeans)
library(dplyr)

test_hypothesis <- function(model, var1, var2, testType, data){
  if (testType == 'overall') {
    full_formula <- model
    full_model <- gamlss(full_formula, data = data)

    term_to_remove <- var1
    reduced_formula <- remove_term_and_interactions(full_formula, term_to_remove)
    reduced_model <- gamlss(reduced_formula, data = data)
    
    lr_result <- LR.test(reduced_model, full_model, print=FALSE)
    p_value <- lr_result$p.val
    print(lr_result)
    return(p_value)
    
  } else if (testType == 'interaction') {
    full_formula <- model
    full_model <- gamlss(full_formula, data = data)
    
    term_to_remove <- var1
    reduced_formula <- expand_and_remove_interaction(full_formula, term_to_remove)
    reduced_model <- gamlss(reduced_formula, data = data)
    
    lr_result <- LR.test(reduced_model, full_model, print=FALSE)
    p_value <- lr_result$p.val
    
    return(p_value)
  
  } else if (testType == 'slope_effect') {
    print(testType)
    # test if slope of a continuous variable is different from zero

    full_formula <- model
    #model <- gamlss(full_formula, data = data)
    model <- lm(full_formula, data = data)
    
    em <- emtrends(model, ~1, var = var2)  ## asking what the slope of var1 is, holding other variables constant
    
    result_df <- test(em, null = 0)[,c(2,6)]
    
    result_df['testVar'] <- var2
    result_df['groupVar'] <- "All"
    result_df['testType'] <- testType
    
    result_df[] <- lapply(result_df, function(x) if (is.numeric(x)) round(x, 4) else x)
    
    print(result_df)
    return(result_df)
    
  } else if (testType == 'level_slope_effect') {
    # For each level, test if slope is different from zero
    
    full_formula <- model
    #model <- gamlss(full_formula, data = data)
    model <- lm(full_formula, data = data)
    formula <- as.formula(paste("~ factor(", var2, ")"))
    em <- emtrends(model, formula, var = var1)
    
    ## use data = data to avoid headache since emtrends will search for "data" globally
    #em <- emtrends(gamlss(Life_expectancy ~ Schooling*Developed_country, data = data), ~factor(Developed_country), var = "Schooling")
    
    test_by_factor <- test(em, null = 0)
    
    test_by_factor <- test_by_factor[,c(1,2,6)]
    test_by_factor['testType'] <- testType
    test_by_factor['testVar'] <- var1
    test_by_factor['groupVar'] <- var2
    test_by_factor[] <- lapply(test_by_factor, function(x) if (is.numeric(x)) round(x, 4) else x)
    
    return(test_by_factor)
    
  } else if (testType == 'level_slope_pair') {
    ## test if the slope for 2 groups are different
    
    full_formula <- model
    model <- gamlss(full_formula, data = data)
    formula <- as.formula(paste("~ factor(", var2, ")"))
    em <- emtrends(model, formula, var = var1)
  
    ## step1: get significance test result
    test_by_factor <- pairs(em)
    test_by_factor <- as.data.frame(summary(test_by_factor))
    test_by_factor<- test_by_factor[, c('contrast','estimate', 'p.value')]
    
    ## step2: get effect size along with lower and upper CL
    es_df <- as.data.frame(summary(eff_size(em, sigma = sigma(model), edf = df.residual(model))))
    es_df <- es_df[, c('contrast', 'effect.size', 'lower.CL', 'upper.CL' )]
    
    ## step3 join the two dataframes
    result_df <- inner_join(test_by_factor, es_df, by = c('contrast'))
    result_df['testVar'] <- var1
    result_df['groupVar'] <- var2
    result_df['testType'] <- testType
    result_df[] <- lapply(result_df, function(x) if (is.numeric(x)) round(x, 4) else x)
    
    return(result_df)
    
  } else if (testType == 'level_val') {
    
    full_formula <- model
    #model <- gamlss(full_formula, data = data)
    model <- lm(full_formula, data = data)
    formula <- as.formula(paste("~ factor(", var2, ")"))
    em <- emmeans(model, formula)
    
    ## step1: get significance test result
    test_by_factor <- pairs(em, simple = var2)  ## compare contrast of var2
    test_by_factor <- as.data.frame(test_by_factor)
    test_by_factor<- test_by_factor[, c('contrast', 'estimate', 'p.value')]
    
    ## step2: get effect size along with lower and upper CL
    es_df <- as.data.frame(summary(eff_size(em, sigma = sigma(model), edf = df.residual(model))))
    es_df <- es_df[, c('contrast', 'effect.size', 'lower.CL', 'upper.CL' )]
    
    ## step3 join the two dataframes
    result_df <- inner_join(test_by_factor, es_df, by = c("contrast"))
    result_df['testVar'] <- var1
    result_df['groupVar'] <- "All"
    result_df['testType'] <- testType
    result_df[] <- lapply(result_df, function(x) if (is.numeric(x)) round(x, 4) else x)
    
    return(result_df)
    
  } else if (testType == 'level_val_interact') {
    ## use lm here instead of gamlss for interaction between 2 categorical variables
    full_formula <- model
    model <- lm(full_formula, data = data)
    formula <- as.formula(paste0("~ factor(", var1, ")"," | ","factor(", var2, ")"))
    em <- emmeans(model, formula)
    
    ## step1: get significance test result
    test_by_factor <- pairs(em, simple = var1)
    test_by_factor <- as.data.frame(summary(test_by_factor))
    test_by_factor<- test_by_factor[, c('contrast', var2, 'estimate', 'p.value')]
    
    ## step2: get effect size along with lower and upper CL
    es_df <- as.data.frame(summary(eff_size(em, sigma = sigma(model), edf = df.residual(model))))
    es_df <- es_df[, c('contrast', var2, 'effect.size', 'lower.CL', 'upper.CL' )]
    
    ## step3 join the two dataframes
    result_df <- inner_join(test_by_factor, es_df, by = c("contrast", var2))
    result_df['testVar'] <- var1
    result_df['groupVar'] <- var2
    result_df['testType'] <- testType
    result_df[] <- lapply(result_df, function(x) if (is.numeric(x)) round(x, 4) else x)
    
    return(result_df)
  }
  
}

remove_term_from_formula <- function(formula, term_to_remove) {
  # Extract the response and the terms
  response <- deparse(formula[[2]])  # Response variable
  terms <- attr(terms(formula), "term.labels")  # Extract terms
  
  # Remove the specified term
  updated_terms <- terms[!terms %in% term_to_remove]
  
  # Construct the new formula
  updated_formula <- as.formula(paste(response, "~", paste(updated_terms, collapse = " + ")))
  return(updated_formula)
}

remove_term_and_interactions <- function(formula, term_to_remove) {
  # Extract the response and terms
  response <- deparse(formula[[2]])  # Response variable
  terms <- attr(terms(formula), "term.labels")  # Extract terms
  
  # Identify terms to keep (exclude the term and its interactions)
  updated_terms <- terms[!grepl(paste0("\\b", term_to_remove, "\\b"), terms)]
  
  # If no terms remain, return an intercept-only model
  if (length(updated_terms) == 0) {
    return(as.formula(paste(response, "~ 1")))
  }
  
  # Construct the new formula
  updated_formula <- as.formula(paste(response, "~", paste(updated_terms, collapse = " + ")))
  return(updated_formula)
}

# Function to replace interaction terms with additive terms
expand_and_remove_interaction <- function(formula, remove) {
  # Extract the response and the terms from the formula
  response <- deparse(formula[[2]])  # Response variable
  terms <- attr(terms(formula), "term.labels")  # All terms in the formula
  
  # Identify and split the interaction term
  if (grepl("\\*", remove)) {
    components <- unlist(strsplit(remove, "\\*"))  # Split interaction term into variables
    additive_terms <- components  # The variables themselves (additive)
    
    # Create a regex pattern to match both interaction and colon-based terms
    interaction_pattern <- paste0("(", paste(components, collapse = "\\*|:"), ")")
  } else {
    stop("The specified term to remove must be an interaction (e.g., 'x1*x2').")
  }
  
  # Filter terms to remove interactions and add additive terms
  updated_terms <- unique(c(terms[!grepl(interaction_pattern, terms)], additive_terms))
  
  # Construct the updated formula
  updated_formula <- as.formula(paste(response, "~", paste(updated_terms, collapse = " + ")))
  return(updated_formula)
}
