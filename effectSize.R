library(gamlss)
library(emmeans)
library(boot)
library(jsonlite)

get_effect_distr <- function(model_formula, var1, var2 , contrast, df) {

  emmeans_formula <- as.formula(paste0("~ factor(", var1, ")"," | ","factor(", var2, ")"))
  
  print(model_formula)
  print(emmeans_formula)
  boot_out <- boot(
    data = df,
    statistic = get_eff_size,
    R = 100,
    model_formula = model_formula,
    emmeans_formula = emmeans_formula,
    contrast_label = contrast
  )
  
  effect_vector <- as.vector(boot_out$t[!is.na(boot_out$t[, 1]), 1])
  return(jsonlite::toJSON(effect_vector))   ## return this format to make it easy for JavaScript

}

get_eff_size <- function(data, indices, model_formula, emmeans_formula, contrast_label) {
  d <- data[indices, ]
  
  tryCatch({
    m <- lm(formula = model_formula, data = d)
    #m$call$data <- quote(data) # Prevent emmeans from looking for 'd' (basically preventing error)-- only for gamlss
    
    em <- emmeans(m, specs = emmeans_formula)
    es <- eff_size(em, sigma = sigma(m), edf = df.residual(m)) %>% as.data.frame()
    
    # Return effect size for matching contrast
    value <- es$effect.size[es$contrast == contrast_label]
    
    # Handle case where contrast isn't found
    if (length(value) == 0) return(NA) else return(value)
    
  }, error = function(e) {
    return(NA)  # return NA if model or emmeans fails
  })
}